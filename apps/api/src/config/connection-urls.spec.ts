import { withConnectionUrls } from './connection-urls';

describe('withConnectionUrls', () => {
  it('builds a TLS database URL from parts, encoding the password', () => {
    const env = withConnectionUrls({
      DATABASE_HOST: 'db.internal',
      DATABASE_NAME: 'nixzora',
      DATABASE_USER: 'nixzora_app',
      DATABASE_PASSWORD: 'p@ss/word#1',
    });
    expect(env.DATABASE_URL).toBe(
      'postgresql://nixzora_app:p%40ss%2Fword%231@db.internal:5432/nixzora?schema=public&sslmode=verify-full',
    );
  });

  it('builds a rediss URL with the auth token', () => {
    expect(
      withConnectionUrls({ REDIS_HOST: 'cache.internal', REDIS_PASSWORD: 'tok:en' }).REDIS_URL,
    ).toBe('rediss://:tok%3Aen@cache.internal:6379');
  });

  it('never overrides URLs that are set', () => {
    const env = withConnectionUrls({ DATABASE_URL: 'postgresql://x', DATABASE_HOST: 'ignored' });
    expect(env.DATABASE_URL).toBe('postgresql://x');
  });
});
