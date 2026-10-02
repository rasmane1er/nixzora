/**
 * In AWS the database and Redis passwords arrive as their own secrets (ECS injects them
 * from Secrets Manager), not as ready-made URLs. When DATABASE_URL or REDIS_URL is missing,
 * build it from the parts so the password never has to be stored inside a URL anywhere.
 *
 *   DATABASE_HOST, DATABASE_PORT=5432, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD,
 *   DATABASE_SSL=verify-full | require | disable
 *   REDIS_HOST, REDIS_PORT=6379, REDIS_PASSWORD, REDIS_TLS=true
 */
type Env = Record<string, string | undefined>;

const enc = encodeURIComponent;

export function withConnectionUrls(env: Env): Env {
  const out = { ...env };
  if (!out.DATABASE_URL && out.DATABASE_HOST && out.DATABASE_USER && out.DATABASE_NAME) {
    const auth = out.DATABASE_PASSWORD
      ? `${enc(out.DATABASE_USER)}:${enc(out.DATABASE_PASSWORD)}`
      : enc(out.DATABASE_USER);
    const ssl = out.DATABASE_SSL ?? 'verify-full';
    out.DATABASE_URL =
      `postgresql://${auth}@${out.DATABASE_HOST}:${out.DATABASE_PORT ?? '5432'}/${enc(out.DATABASE_NAME)}` +
      `?schema=public${ssl === 'disable' ? '' : `&sslmode=${ssl}`}`;
  }
  if (!out.REDIS_URL && out.REDIS_HOST) {
    const scheme = out.REDIS_TLS === 'false' ? 'redis' : 'rediss';
    const auth = out.REDIS_PASSWORD ? `:${enc(out.REDIS_PASSWORD)}@` : '';
    out.REDIS_URL = `${scheme}://${auth}${out.REDIS_HOST}:${out.REDIS_PORT ?? '6379'}`;
  }
  return out;
}
