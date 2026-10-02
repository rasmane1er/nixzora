import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AddressSchema,
  CartIdSchema,
  CheckoutRequestSchema,
  OrderFulfillmentSchema,
} from './commerce';

const address = {
  fullName: 'Ada Lovelace',
  line1: '100 Main St',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};

test('US addresses are accepted and normalized', () => {
  const parsed = AddressSchema.parse({ ...address, line2: '', phone: '' });
  assert.equal(parsed.line2, undefined);
  assert.equal(parsed.phone, undefined);
});

test('addresses outside the launch market are refused', () => {
  assert.equal(AddressSchema.safeParse({ ...address, country: 'CA' }).success, false);
  assert.equal(AddressSchema.safeParse({ ...address, region: 'ON' }).success, false);
  assert.equal(AddressSchema.safeParse({ ...address, postalCode: '2061' }).success, false);
});

test('checkout lowercases the email', () => {
  const parsed = CheckoutRequestSchema.parse({
    email: ' Ada@Example.COM ',
    shippingAddress: address,
  });
  assert.equal(parsed.email, 'ada@example.com');
});

test('guest cart ids are 43-character base64url tokens', () => {
  assert.equal(CartIdSchema.safeParse('a'.repeat(43)).success, true);
  assert.equal(CartIdSchema.safeParse('../../etc/passwd').success, false);
});

test('shipping needs a carrier and tracking number', () => {
  assert.equal(OrderFulfillmentSchema.safeParse({ action: 'ship', carrier: 'UPS' }).success, false);
  assert.equal(
    OrderFulfillmentSchema.safeParse({
      action: 'ship',
      carrier: 'UPS',
      trackingNumber: '1Z999AA10123456784',
    }).success,
    true,
  );
});
