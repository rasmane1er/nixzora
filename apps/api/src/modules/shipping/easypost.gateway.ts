import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import {
  type Label,
  type Parcel,
  type ShipAddress,
  type ShippingGateway,
  type TrackingDetail,
  type TrackingEvent,
} from './shipping-gateway';

type Rate = { id: string; carrier: string; service: string; rate: string };

/** EasyPost tracking statuses → the steps the order page shows. */
const STEP: Record<string, TrackingDetail['status']> = {
  pre_transit: 'LABEL_CREATED',
  in_transit: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  available_for_pickup: 'OUT_FOR_DELIVERY',
  return_to_sender: 'EXCEPTION',
  failure: 'EXCEPTION',
  error: 'EXCEPTION',
  cancelled: 'EXCEPTION',
};

/**
 * EasyPost over its REST API (no SDK needed): create a shipment, buy the lowest rate, and
 * receive tracker updates through signed webhooks.
 */
export class EasyPostGateway implements ShippingGateway {
  readonly name = 'EASYPOST' as const;
  private readonly base = 'https://api.easypost.com/v2';

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string | undefined,
  ) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) {
      throw new BadGatewayException(`Postage provider: ${data.error?.message ?? res.statusText}`);
    }
    return data;
  }

  async buyLabel(input: {
    reference: string;
    from: ShipAddress;
    to: ShipAddress;
    parcel: Parcel;
  }): Promise<Label> {
    const shipment = await this.call<{ id: string; rates: Rate[] }>('/shipments', {
      shipment: {
        reference: input.reference,
        from_address: input.from,
        to_address: input.to,
        parcel: {
          length: input.parcel.lengthIn,
          width: input.parcel.widthIn,
          height: input.parcel.heightIn,
          weight: input.parcel.weightOz,
        },
      },
    });
    const cheapest = [...shipment.rates].sort((a, b) => Number(a.rate) - Number(b.rate))[0];
    if (!cheapest)
      throw new BadGatewayException('No shipping rates are available for this address.');
    const bought = await this.call<{
      tracking_code: string;
      postage_label: { label_url: string };
      selected_rate: Rate;
    }>(`/shipments/${shipment.id}/buy`, { rate: { id: cheapest.id } });
    return {
      carrier: bought.selected_rate.carrier,
      service: bought.selected_rate.service,
      trackingNumber: bought.tracking_code,
      labelUrl: bought.postage_label.label_url,
      postageCents: Math.round(Number(bought.selected_rate.rate) * 100),
    };
  }

  /** EasyPost signs bodies with HMAC-SHA256 of the NFKD-normalized secret ("hmac-sha256-hex=…"). */
  /**
   * Creates an EasyPost tracker; EasyPost then sends tracker.updated webhooks for it. Without a
   * webhook secret those updates could not be verified, so nothing is tracked.
   */
  async trackShipment(input: { trackingNumber: string; carrier: string }): Promise<boolean> {
    if (!this.webhookSecret) return false;
    await this.call('/trackers', {
      tracker: { tracking_code: input.trackingNumber, carrier: input.carrier },
    });
    return true;
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): TrackingEvent | null {
    if (!this.webhookSecret) throw new BadRequestException('Tracking webhooks are not configured.');
    const header = headers['x-hmac-signature'];
    const given = Array.isArray(header) ? header[0] : header;
    const expected = `hmac-sha256-hex=${createHmac('sha256', this.webhookSecret.normalize('NFKD')).update(rawBody).digest('hex')}`;
    if (
      !given ||
      given.length !== expected.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      throw new BadRequestException('Invalid webhook signature.');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      description: string;
      result?: {
        tracking_code?: string;
        status?: string;
        carrier?: string;
        est_delivery_date?: string | null;
        tracking_details?: {
          status?: string;
          message?: string;
          datetime?: string;
          tracking_location?: { city?: string | null; state?: string | null } | null;
        }[];
      };
    };
    if (event.description !== 'tracker.updated' || !event.result?.tracking_code) return null;
    const status =
      event.result.status === 'delivered'
        ? 'delivered'
        : event.result.status === 'in_transit' || event.result.status === 'out_for_delivery'
          ? 'in_transit'
          : 'other';
    const details = (event.result.tracking_details ?? []).flatMap((d) => {
      const at = d.datetime ? new Date(d.datetime) : null;
      if (!at || Number.isNaN(at.getTime())) return [];
      const place = [d.tracking_location?.city, d.tracking_location?.state].filter(Boolean);
      return [
        {
          status: STEP[d.status ?? ''] ?? ('OTHER' as const),
          description: (d.message ?? '').slice(0, 200) || (d.status ?? ''),
          location: place.length ? place.join(', ') : null,
          at,
        },
      ];
    });
    const estimate = event.result.est_delivery_date
      ? new Date(event.result.est_delivery_date)
      : null;
    return {
      id: event.id,
      trackingNumber: event.result.tracking_code,
      status,
      carrier: event.result.carrier ?? null,
      estimatedDeliveryAt: estimate && !Number.isNaN(estimate.getTime()) ? estimate : null,
      details,
    };
  }
}
