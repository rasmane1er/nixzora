import { execFileSync } from 'node:child_process';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isSnsUrl,
  parseSnsMessage,
  sesFeedback,
  type SnsMessage,
  stringToSign,
  verifySnsSignature,
} from './sns-message';

/** A self-signed certificate standing in for SNS's, made with openssl. */
function testCertificate() {
  const dir = mkdtempSync(join(tmpdir(), 'sns-'));
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyPath = join(dir, 'key.pem');
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const certPath = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req',
    '-x509',
    '-key',
    keyPath,
    '-out',
    certPath,
    '-days',
    '1',
    '-subj',
    '/CN=sns.amazonaws.com',
  ]);
  return { privateKey, pem: readFileSync(certPath, 'utf8') };
}

const base: SnsMessage = {
  Type: 'Notification',
  MessageId: 'm-1',
  TopicArn: 'arn:aws:sns:us-east-1:123456789012:nixzora-staging-ses-events',
  Message: JSON.stringify({
    eventType: 'Bounce',
    bounce: {
      bounceType: 'Permanent',
      bouncedRecipients: [{ emailAddress: 'Gone@Example.com', diagnosticCode: 'smtp; 550 5.1.1' }],
    },
  }),
  Timestamp: '2027-03-01T00:00:00.000Z',
  SignatureVersion: '2',
  Signature: '',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem',
};

describe('SNS messages', () => {
  const { privateKey, pem } = testCertificate();
  const sign = (message: SnsMessage) =>
    createSign('RSA-SHA256').update(stringToSign(message)).sign(privateKey, 'base64');

  it('accepts a message signed with the certificate, and nothing altered', () => {
    const signed = { ...base, Signature: sign(base) };
    expect(verifySnsSignature(signed, pem)).toBe(true);
    expect(verifySnsSignature({ ...signed, Message: '{"eventType":"Delivery"}' }, pem)).toBe(false);
    expect(verifySnsSignature({ ...signed, TopicArn: 'arn:aws:sns:x:1:other' }, pem)).toBe(false);
  });

  it('trusts certificates and links only from SNS itself', () => {
    expect(isSnsUrl(base.SigningCertURL, /\.pem$/)).toBe(true);
    expect(isSnsUrl('https://sns.us-east-1.amazonaws.com.evil.example/x.pem')).toBe(false);
    expect(isSnsUrl('http://sns.us-east-1.amazonaws.com/x.pem')).toBe(false);
    expect(isSnsUrl('https://evil.example/sns.us-east-1.amazonaws.com')).toBe(false);
  });

  it('parses only well-formed SNS messages', () => {
    expect(parseSnsMessage({ ...base, Signature: 'x' })).not.toBeNull();
    expect(parseSnsMessage({ Type: 'Notification' })).toBeNull();
    expect(parseSnsMessage('nope')).toBeNull();
  });
});

describe('sesFeedback', () => {
  it('suppresses permanent bounces, lowercased', () => {
    expect(sesFeedback(base.Message)).toEqual({
      kind: 'BOUNCE',
      addresses: ['gone@example.com'],
      detail: 'smtp; 550 5.1.1',
      template: null,
    });
  });

  it('suppresses complaints', () => {
    const complaint = JSON.stringify({
      eventType: 'Complaint',
      mail: { tags: { template: ['orders.receipt'] } },
      complaint: {
        complainedRecipients: [{ emailAddress: 'a@example.com' }],
        complaintFeedbackType: 'abuse',
      },
    });
    expect(sesFeedback(complaint)).toEqual({
      kind: 'COMPLAINT',
      addresses: ['a@example.com'],
      detail: 'abuse',
      template: 'orders.receipt',
    });
  });

  it('ignores temporary bounces and other events', () => {
    expect(
      sesFeedback(JSON.stringify({ eventType: 'Bounce', bounce: { bounceType: 'Transient' } })),
    ).toBeNull();
    expect(sesFeedback(JSON.stringify({ eventType: 'Delivery' }))).toBeNull();
    expect(sesFeedback('not json')).toBeNull();
  });
});
