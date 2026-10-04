import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EmailSchema,
  flagOf,
  internationalNumber,
  MfaCodeSchema,
  passwordChecks,
  PasswordSchema,
  RegisterRequestSchema,
  signUpProblems,
} from './auth';

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

test('internationalNumber builds E.164 numbers', () => {
  assert.equal(internationalNumber('US', '(301) 555-0199'), '+13015550199');
  assert.equal(internationalNumber('FR', '06 12 34 56 78'), '+33612345678');
  assert.equal(internationalNumber('BF', '70 12 34 56'), '+22670123456');
  assert.equal(internationalNumber('US', '  '), null);
  assert.equal(flagOf('us'), '🇺🇸');
});

test('RegisterRequestSchema accepts the sign-up extras and rejects bad numbers', () => {
  const base = { email: 'a@example.com', password: 'correct horse battery' };
  assert.equal(
    RegisterRequestSchema.safeParse({
      ...base,
      phone: '+13015550199',
      acceptTerms: true,
      marketingEmails: false,
    }).success,
    true,
  );
  assert.equal(RegisterRequestSchema.safeParse({ ...base, phone: '3015550199' }).success, false);
  assert.equal(RegisterRequestSchema.safeParse({ ...base, acceptTerms: false }).success, false);
});

test('signUpProblems checks every field the form shows', () => {
  const values = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phoneCountry: 'US',
    phone: '',
    password: 'analytical engine 1843',
    confirmPassword: 'analytical engine 1843',
    acceptTerms: true,
  };
  assert.deepEqual(signUpProblems(values), {});
  assert.deepEqual(signUpProblems({ ...values, firstName: ' ', acceptTerms: false, phone: '12' }), {
    firstName: 'firstNameRequired',
    phone: 'phoneInvalid',
    acceptTerms: 'termsRequired',
  });
  assert.equal(
    signUpProblems({
      ...values,
      password: 'lovelace-is-great',
      confirmPassword: 'lovelace-is-great',
    }).password,
    'passwordPersonal',
  );
  assert.equal(
    signUpProblems({ ...values, confirmPassword: 'other' }).confirmPassword,
    'passwordMismatch',
  );
  assert.deepEqual(passwordChecks({ ...values, password: 'short', confirmPassword: '' }), {
    length: false,
    notPersonal: true,
    matches: false,
  });
});
