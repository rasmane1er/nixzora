import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmailSchema, MfaCodeSchema, PasswordSchema, RegisterRequestSchema } from './auth';

test('EmailSchema normalizes case and whitespace', () => {
  assert.equal(EmailSchema.parse('  Ana@Example.COM '), 'ana@example.com');
});

test('PasswordSchema enforces 12 to 128 characters', () => {
  assert.equal(PasswordSchema.safeParse('short-pass').success, false);
  assert.equal(PasswordSchema.safeParse('correct horse battery').success, true);
  assert.equal(PasswordSchema.safeParse('x'.repeat(129)).success, false);
});

test('MfaCodeSchema accepts TOTP and recovery codes only', () => {
  assert.equal(MfaCodeSchema.parse('123456'), '123456');
  assert.equal(MfaCodeSchema.parse('7kq2-m9xd-4tpa'), '7KQ2-M9XD-4TPA');
  assert.equal(MfaCodeSchema.safeParse('12345').success, false);
});

test('RegisterRequestSchema rejects an invalid email', () => {
  const result = RegisterRequestSchema.safeParse({
    email: 'nope',
    password: 'long enough password',
  });
  assert.equal(result.success, false);
});
