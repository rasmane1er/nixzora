import { z } from 'zod';
import { withConnectionUrls } from './connection-urls';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** Base64 of a PEM file, so multi-line keys fit on one environment variable line. */
const base64Pem = z
  .string()
  .min(40)
  .transform((value) => Buffer.from(value, 'base64').toString('utf8'))
  .refine((pem) => pem.includes('-----BEGIN'), { message: 'must be a base64-encoded PEM key' });

/**
 * Every environment variable the API reads, validated once at startup.
 * The process refuses to boot with a clear message if anything is missing or malformed.
 */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    APP_VERSION: z.string().default('0.2.0'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    /** Per-IP request limits. Only end-to-end tests turn this off. */
    RATE_LIMIT_ENABLED: booleanString.default(true),

    /** Public URL of the storefront, used in email links. */
    WEB_APP_URL: z.url().default('http://localhost:3000'),

    // ── Identity ──
    JWT_ISSUER: z.string().default('nixzora-api'),
    JWT_AUDIENCE: z.string().default('nixzora'),
    /** Ed25519 key pair (base64 of PEM). Generate with: pnpm --filter @nixzora/api keys:generate */
    JWT_PRIVATE_KEY: base64Pem.optional(),
    JWT_PUBLIC_KEY: base64Pem.optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** 32 random bytes, base64. Encrypts TOTP secrets at rest. */
    MFA_ENCRYPTION_KEY: z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, {
        message: 'must be 32 bytes, base64-encoded',
      })
      .optional(),
    /** Check new passwords against Have I Been Pwned (k-anonymity, no password leaves the server). */
    PASSWORD_BREACH_CHECK: booleanString.default(false),
    LOGIN_MAX_FAILURES: z.coerce.number().int().min(3).max(50).default(10),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

    // ── Sign in with Google / Apple (public client identifiers, not secrets) ──
    /** OAuth client id of the "Web application" client: the storefront's Google button. */
    GOOGLE_WEB_CLIENT_ID: z.string().optional(),
    /** OAuth client ids of the iOS and Android clients: the mobile app. */
    GOOGLE_IOS_CLIENT_ID: z.string().optional(),
    GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
    /** Services ID registered for Sign in with Apple on the web, e.g. "com.nixzora.shop.web". */
    APPLE_SERVICES_ID: z.string().optional(),
    /** iOS bundle ids allowed to sign in natively (comma-separated). */
    APPLE_BUNDLE_IDS: z
      .string()
      .default('com.nixzora.shop,com.nixzora.shop.preview,com.nixzora.shop.dev')
      .transform((value) =>
        value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),

    // ── Media storage ──
    /** Public base URL of this API, used for locally served media and upload links. */
    API_PUBLIC_URL: z.url().default('http://localhost:4000'),
    /** "local" stores files on disk (development); "s3" uses Amazon S3 with presigned uploads. */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    /** Signs local upload links. Any long random string; generated per run if missing. */
    MEDIA_SIGNING_SECRET: z.string().min(32).optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    /** CloudFront (or bucket) URL that serves uploaded files. */
    ASSETS_BASE_URL: z.url().optional(),

    // ── Checkout ──
    /** "fake" confirms payments without a card (development and tests); "stripe" is real. */
    PAYMENTS_PROVIDER: z.enum(['fake', 'stripe']).default('fake'),
    /** Staging/demo only: allow the fake provider with NODE_ENV=production (no card, no money). */
    ALLOW_TEST_PAYMENTS: booleanString.default(false),
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^(sk|rk)_(test|live)_/)
      .optional(),
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^pk_(test|live)_/)
      .optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
    /** Flat shipping rate, free above the threshold. */
    SHIPPING_FLAT_CENTS: z.coerce.number().int().min(0).default(999),
    FREE_SHIPPING_THRESHOLD_CENTS: z.coerce.number().int().min(0).default(9900),
    /**
     * Sales tax by US state in basis points ("MD:600,VA:530"). Tax is collected only where the
     * business is registered; Stripe Tax replaces this table before expanding (Phase 4).
     */
    TAX_RATES_BPS: z
      .string()
      .default('MD:600')
      .transform((value, ctx) => {
        const rates: Record<string, number> = {};
        for (const pair of value
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)) {
          const match = /^([A-Z]{2}):(\d{1,4})$/.exec(pair);
          if (!match) {
            ctx.addIssue({ code: 'custom', message: `"${pair}" must look like MD:600` });
            return z.NEVER;
          }
          rates[match[1]!] = Number(match[2]);
        }
        return rates;
      }),
    /** Signs order links for guests ("see your order"). Required in production. */
    ORDER_LINK_SECRET: z.string().min(32).default('development-only-order-link-secret-0000'),
    /** Minutes a checkout holds stock while the customer pays. */
    CHECKOUT_HOLD_MINUTES: z.coerce.number().int().min(5).max(60).default(15),

    // ── Shipping labels ──
    /** "fake" makes printable test labels; "easypost" buys real postage; "none" = staff enter tracking. */
    SHIPPING_PROVIDER: z.enum(['fake', 'easypost', 'none']).default('fake'),
    EASYPOST_API_KEY: z.string().min(10).optional(),
    EASYPOST_WEBHOOK_SECRET: z.string().min(10).optional(),
    /** Where parcels ship from (the warehouse). */
    SHIP_FROM_NAME: z.string().default('NIXZORA Fulfillment'),
    SHIP_FROM_STREET: z.string().default('100 Warehouse Way'),
    SHIP_FROM_CITY: z.string().default('Upper Marlboro'),
    SHIP_FROM_STATE: z.string().length(2).default('MD'),
    SHIP_FROM_ZIP: z.string().default('20774'),
    SHIP_FROM_PHONE: z.string().default('3015550100'),

    // ── Email ──
    /** "log" prints emails (development); "ses" sends with Amazon SES. */
    MAIL_DRIVER: z.enum(['log', 'ses']).default('log'),
    MAIL_FROM: z.string().default('NIXZORA <orders@nixzora.local>'),
    SES_REGION: z.string().default('us-east-1'),

    // ── Push notifications (mobile app) ──
    /** "log" records pushes (development); "expo" sends through Expo's push service. */
    PUSH_DRIVER: z.enum(['log', 'expo']).default('log'),
    /** Optional: required only when "enhanced push security" is on in the Expo project. */
    EXPO_ACCESS_TOKEN: z.string().min(10).optional(),

    // ── Client identity behind the load balancer ──
    /** Proxies in front of the API whose X-Forwarded-For is trusted (1 on AWS: the ALB). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** Shared with the storefront and Ops Center so they can relay the shopper's IP. */
    INTERNAL_API_KEY: z.string().min(32).optional(),

    // ── AI layer (ADR-0009) ──
    /** "local" works offline with no key (development, CI, demo); "voyage" calls Voyage AI. */
    EMBEDDINGS_DRIVER: z.enum(['local', 'voyage']).default('local'),
    VOYAGE_API_KEY: z.string().min(10).optional(),
    VOYAGE_MODEL: z.string().default('voyage-4-lite'),
    /** "local" is a rule-based assistant; "anthropic" uses Claude. */
    AI_DRIVER: z.enum(['local', 'anthropic']).default('local'),
    ANTHROPIC_API_KEY: z.string().min(10).optional(),
    AI_MODEL: z.string().default('claude-haiku-4-5'),
    /** Hard cap on paid model spend per UTC day, in US cents; past it the local driver answers. */
    AI_DAILY_BUDGET_CENTS: z.coerce.number().int().min(0).default(200),
    /** "hybrid" merges keyword and vector results; "lexical" is keyword search only. */
    SEARCH_MODE: z.enum(['hybrid', 'lexical']).default('hybrid'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'ASSETS_BASE_URL'] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when STORAGE_DRIVER=s3',
          });
      }
    }
    if (env.PAYMENTS_PROVIDER === 'stripe') {
      for (const key of [
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when PAYMENTS_PROVIDER=stripe',
          });
      }
    }
    if (env.SHIPPING_PROVIDER === 'easypost' && !env.EASYPOST_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['EASYPOST_API_KEY'],
        message: 'is required when SHIPPING_PROVIDER=easypost',
      });
    }
    if (env.EMBEDDINGS_DRIVER === 'voyage' && !env.VOYAGE_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['VOYAGE_API_KEY'],
        message: 'is required when EMBEDDINGS_DRIVER=voyage',
      });
    }
    if (env.AI_DRIVER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'is required when AI_DRIVER=anthropic',
      });
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.PAYMENTS_PROVIDER !== 'stripe' && !env.ALLOW_TEST_PAYMENTS) {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENTS_PROVIDER'],
        message: 'must be "stripe" in production (or set ALLOW_TEST_PAYMENTS=true for a demo)',
      });
    }
    if (env.ORDER_LINK_SECRET.startsWith('development-only')) {
      ctx.addIssue({
        code: 'custom',
        path: ['ORDER_LINK_SECRET'],
        message: 'is required in production',
      });
    }
    if (env.SHIPPING_PROVIDER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['SHIPPING_PROVIDER'],
        message: 'must be "easypost" or "none" in production',
      });
    }
    if (env.MAIL_DRIVER !== 'ses') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_DRIVER'],
        message: 'must be "ses" in production',
      });
    }
    if (env.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'must be "s3" in production',
      });
    }
    for (const key of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'MFA_ENCRYPTION_KEY'] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'is required in production' });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  // "KEY=" in a .env file means "not set", not an empty value.
  const present = withConnectionUrls(
    Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== '' && value !== undefined),
    ) as Record<string, string>,
  );
  const result = EnvSchema.safeParse(present);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
