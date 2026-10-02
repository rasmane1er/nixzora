import { type Request } from 'express';
import { requestMetaFrom, setInternalApiKey } from './request-meta';

const key = 'k'.repeat(48);
const req = (headers: Record<string, string>) =>
  ({
    ip: '10.0.0.9',
    headers: { 'user-agent': 'nixzora-storefront', ...headers },
  }) as unknown as Request;

describe('client identity', () => {
  afterEach(() => setInternalApiKey(undefined));

  it('believes relayed headers only with the internal key', () => {
    setInternalApiKey(key);
    const relayed = { 'x-client-ip': '203.0.113.7', 'x-client-user-agent': 'Safari' };
    expect(requestMetaFrom(req({ ...relayed, 'x-internal-key': key }))).toEqual({
      ipAddress: '203.0.113.7',
      userAgent: 'Safari',
    });
    expect(requestMetaFrom(req({ ...relayed, 'x-internal-key': 'x'.repeat(48) }))).toEqual({
      ipAddress: '10.0.0.9',
      userAgent: 'nixzora-storefront',
    });
  });

  it('ignores relayed headers when no key is configured or the IP is malformed', () => {
    expect(
      requestMetaFrom(req({ 'x-client-ip': '203.0.113.7', 'x-internal-key': key })).ipAddress,
    ).toBe('10.0.0.9');
    setInternalApiKey(key);
    expect(
      requestMetaFrom(req({ 'x-client-ip': 'not-an-ip', 'x-internal-key': key })).ipAddress,
    ).toBe('10.0.0.9');
  });
});
