import { createHmac } from 'node:crypto';
import { EasyPostGateway } from './easypost.gateway';

describe('EasyPost tracker webhooks', () => {
  const secret = 'whsec-test-0123456789';
  const gateway = new EasyPostGateway('key', secret);
  const sign = (body: string) => ({
    'x-hmac-signature': `hmac-sha256-hex=${createHmac('sha256', secret).update(body).digest('hex')}`,
  });

  it('reads every scan, where it happened and the carrier estimate', () => {
    const body = JSON.stringify({
      id: 'evt_1',
      description: 'tracker.updated',
      result: {
        tracking_code: '9400TEST',
        status: 'out_for_delivery',
        carrier: 'USPS',
        est_delivery_date: '2026-10-15T20:00:00Z',
        tracking_details: [
          { status: 'pre_transit', message: 'Label created', datetime: '2026-10-12T14:00:00Z' },
          {
            status: 'in_transit',
            message: 'Arrived at facility',
            datetime: '2026-10-13T09:00:00Z',
            tracking_location: { city: 'Baltimore', state: 'MD' },
          },
          { status: 'out_for_delivery', message: 'Out for delivery', datetime: 'not a date' },
        ],
      },
    });
    const event = gateway.parseWebhook(Buffer.from(body), sign(body));
    expect(event).toMatchObject({
      trackingNumber: '9400TEST',
      status: 'in_transit',
      carrier: 'USPS',
      estimatedDeliveryAt: new Date('2026-10-15T20:00:00Z'),
    });
    expect(event?.details).toEqual([
      {
        status: 'LABEL_CREATED',
        description: 'Label created',
        location: null,
        at: new Date('2026-10-12T14:00:00Z'),
      },
      {
        status: 'IN_TRANSIT',
        description: 'Arrived at facility',
        location: 'Baltimore, MD',
        at: new Date('2026-10-13T09:00:00Z'),
      },
    ]);
  });
});
