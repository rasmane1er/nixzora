import { createHmac, randomInt } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import {
  type Label,
  type Parcel,
  type ShipAddress,
  type ShippingGateway,
} from './shipping-gateway';

/**
 * Development gateway: makes up a USPS-style tracking number and points the label at a
 * printable page served by the API, signed so label links can't be guessed.
 */
export class FakeShippingGateway implements ShippingGateway {
  readonly name = 'FAKE' as const;

  constructor(
    private readonly apiPublicUrl: string,
    private readonly secret: string,
  ) {}

  signature(reference: string): string {
    return createHmac('sha256', this.secret).update(`label:${reference}`).digest('base64url');
  }

  async buyLabel(input: {
    reference: string;
    from: ShipAddress;
    to: ShipAddress;
    parcel: Parcel;
  }): Promise<Label> {
    const digits = Array.from({ length: 18 }, () => randomInt(10)).join('');
    return {
      carrier: 'USPS',
      service: 'GroundAdvantage',
      trackingNumber: `9400${digits}`,
      labelUrl: `${this.apiPublicUrl}/api/v1/shipping/test-labels/${encodeURIComponent(input.reference)}?sig=${this.signature(input.reference)}`,
      postageCents: 800 + Math.round(input.parcel.weightOz * 5),
    };
  }

  /** No carrier behind it: seller shipments are taken at their word (development, demo). */
  trackShipment(): Promise<boolean> {
    return Promise.resolve(false);
  }

  parseWebhook(): null {
    throw new BadRequestException('The test shipping gateway has no webhooks.');
  }
}
