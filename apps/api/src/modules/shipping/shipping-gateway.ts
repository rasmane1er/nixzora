import { ConflictException } from '@nestjs/common';

/** Postage providers behind one interface (EasyPost today; Shippo would fit the same shape). */
export type Parcel = { lengthIn: number; widthIn: number; heightIn: number; weightOz: number };

export type ShipAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
};

export type Label = {
  carrier: string;
  service: string;
  trackingNumber: string;
  labelUrl: string;
  postageCents: number;
};

/** A verified tracking update. */
export type TrackingEvent = {
  id: string;
  trackingNumber: string;
  status: 'in_transit' | 'delivered' | 'other';
};

export interface ShippingGateway {
  readonly name: 'EASYPOST' | 'FAKE' | 'NONE';
  /** Buys the cheapest rate for the parcel and returns a printable label. */
  buyLabel(input: {
    reference: string;
    from: ShipAddress;
    to: ShipAddress;
    parcel: Parcel;
  }): Promise<Label>;
  /**
   * Asks the carrier to report on a tracking number someone else bought (a seller's own label).
   * True when updates will arrive by webhook; false when this gateway cannot track.
   */
  trackShipment(input: { trackingNumber: string; carrier: string }): Promise<boolean>;
  /** Verifies the webhook signature; returns null for events we ignore. */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): TrackingEvent | null;
}

export const SHIPPING_GATEWAY = Symbol('SHIPPING_GATEWAY');

/** Label buying turned off: staff ship with their own carrier account and type the tracking number. */
export class NoShippingGateway implements ShippingGateway {
  readonly name = 'NONE' as const;

  buyLabel(): Promise<Label> {
    return Promise.reject(
      new ConflictException('Label buying is not set up. Enter the tracking number instead.'),
    );
  }

  trackShipment(): Promise<boolean> {
    return Promise.resolve(false);
  }

  parseWebhook(): TrackingEvent | null {
    throw new ConflictException('Tracking webhooks are not set up.');
  }
}
