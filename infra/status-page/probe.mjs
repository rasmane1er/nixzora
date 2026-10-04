// Status page probe (p9-11). Runs every minute in AWS Lambda, outside the app's own servers:
// checks the storefront and the API from the outside, then writes status.json next to the
// static status page (S3 + CloudFront), so the page stays up and honest when the site is down.
//
// Environment: STOREFRONT_URL, API_HEALTH_URL, BUCKET, NOTE_PARAMETER.
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const s3 = new S3Client({});
const ssm = new SSMClient({});
const DAYS_KEPT = 90;
const TIMEOUT_MS = 10_000;
/** Slower than this counts as degraded, not down. */
const SLOW_MS = 3_000;

async function check(url, isHealthy) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'nixzora-status-probe' },
      redirect: 'follow',
    });
    const latencyMs = Date.now() - started;
    const ok = res.ok && (await isHealthy(res));
    return { status: !ok ? 'down' : latencyMs > SLOW_MS ? 'degraded' : 'up', latencyMs };
  } catch {
    return { status: 'down', latencyMs: null };
  }
}

async function readJson(key) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }));
    return JSON.parse(await object.Body.transformToString());
  } catch {
    return null;
  }
}

async function note() {
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: process.env.NOTE_PARAMETER }));
    const text = (result.Parameter?.Value ?? '').trim();
    return text && text !== '-' ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}

/** Adds one check to the per-day counts and drops days older than DAYS_KEPT. */
export function tally(days, date, status) {
  const next = { ...(days ?? {}) };
  const day = next[date] ?? { up: 0, total: 0 };
  next[date] = { up: day.up + (status === 'down' ? 0 : 1), total: day.total + 1 };
  return Object.fromEntries(Object.entries(next).sort().slice(-DAYS_KEPT));
}

export async function handler() {
  const [store, api, message, previous] = await Promise.all([
    check(process.env.STOREFRONT_URL, async () => true),
    check(process.env.API_HEALTH_URL, async (res) => {
      const body = await res.json().catch(() => ({}));
      return body.status === 'ok';
    }),
    note(),
    readJson('status.json'),
  ]);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const components = { store, api };
  const status = {
    checkedAt: now.toISOString(),
    note: message,
    components: Object.fromEntries(
      Object.entries(components).map(([name, result]) => [
        name,
        { ...result, days: tally(previous?.components?.[name]?.days, date, result.status) },
      ]),
    ),
  };
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Key: 'status.json',
      Body: JSON.stringify(status),
      ContentType: 'application/json',
      CacheControl: 'public, max-age=30',
    }),
  );
  return { store: store.status, api: api.status };
}
