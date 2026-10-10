import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReferralClaimSchema } from './referrals';

test('invite codes are upper-cased and letters or digits only', () => {
  assert.equal(ReferralClaimSchema.parse({ code: ' ada7kq ' }).code, 'ADA7KQ');
  assert.equal(ReferralClaimSchema.safeParse({ code: 'ab' }).success, false);
  assert.equal(ReferralClaimSchema.safeParse({ code: 'ada-7kq' }).success, false);
});
