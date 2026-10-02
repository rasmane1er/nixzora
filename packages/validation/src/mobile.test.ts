import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PushDeviceRegisterSchema } from './mobile';

test('push devices need an Expo token and a platform', () => {
  const ok = PushDeviceRegisterSchema.safeParse({
    token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    platform: 'ios',
  });
  assert.equal(ok.success, true);
  assert.equal(
    PushDeviceRegisterSchema.safeParse({ token: 'fcm:abc', platform: 'android' }).success,
    false,
  );
  assert.equal(
    PushDeviceRegisterSchema.safeParse({ token: 'ExpoPushToken[abcdefgh12]', platform: 'web' })
      .success,
    false,
  );
});
