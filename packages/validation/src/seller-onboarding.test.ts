import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SellerApplicationDraftSchema,
  SellerBusinessStepSchema,
  SellerOwnerStepSchema,
  SellerShippingStepSchema,
  sellerProceeds,
} from './seller-onboarding';

const business = {
  businessType: 'LLC',
  legalName: 'Brightline Audio LLC',
  displayName: 'Brightline Audio',
  category: 'audio',
  whatYouSell: 'Desk speakers',
  website: '',
  address: {
    line1: '1 Harbor St',
    city: 'Baltimore',
    region: 'MD',
    postalCode: '21202',
    country: 'US',
  },
};

test('the business step needs a US address and treats an empty website as none', () => {
  const parsed = SellerBusinessStepSchema.parse(business);
  assert.equal(parsed.website, undefined);
  assert.equal(
    SellerBusinessStepSchema.safeParse({
      ...business,
      address: { ...business.address, region: 'ON' },
    }).success,
    false,
  );
});

test('owners must be adults', () => {
  const owner = {
    firstName: 'Ada',
    lastName: 'L',
    phone: '+1 410 555 0100',
    residenceCountry: 'US',
  };
  assert.equal(
    SellerOwnerStepSchema.safeParse({ ...owner, dateOfBirth: '1990-05-02' }).success,
    true,
  );
  const year = new Date().getUTCFullYear() - 17;
  assert.equal(
    SellerOwnerStepSchema.safeParse({ ...owner, dateOfBirth: `${year}-01-01` }).success,
    false,
  );
});

test('stores ship to the contiguous US with at least one carrier', () => {
  const ok = {
    handlingDays: '2',
    carriers: ['USPS'],
    shipRegions: ['US_CONTIGUOUS'],
    acceptReturnPolicy: true,
  };
  assert.equal(SellerShippingStepSchema.parse(ok).handlingDays, 2);
  assert.equal(SellerShippingStepSchema.safeParse({ ...ok, carriers: [] }).success, false);
  assert.equal(
    SellerShippingStepSchema.safeParse({ ...ok, shipRegions: ['ALASKA_HAWAII'] }).success,
    false,
  );
  assert.equal(SellerShippingStepSchema.safeParse({ ...ok, handlingDays: 5 }).success, false);
});

test('commission is taken on the item price only', () => {
  assert.deepEqual(sellerProceeds(10_000, 800, 1200), {
    commissionCents: 1200,
    proceedsCents: 9600,
  });
});

test('drafts are capped in size', () => {
  const big = { notes: 'x'.repeat(21_000) };
  assert.equal(
    SellerApplicationDraftSchema.safeParse({ step: 1, completed: [], data: big }).success,
    false,
  );
});
