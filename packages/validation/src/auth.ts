import { z } from 'zod';

/** Email is trimmed and lower-cased so "Ana@Example.com" and "ana@example.com" are one account. */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }).max(254));

/**
 * NIST SP 800-63B style: length over composition rules.
 * Breached-password screening happens on the server.
 */
export const PasswordSchema = z
  .string()
  .min(12, { message: 'Use at least 12 characters.' })
  .max(128, { message: 'Use 128 characters or fewer.' });

const DeviceNameSchema = z.string().trim().min(1).max(100).optional();

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  deviceName: DeviceNameSchema,
});

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  // No length rule on login: never reveal password policy details for existing accounts.
  password: z.string().min(1).max(128),
  deviceName: DeviceNameSchema,
});

/** Mobile apps send the refresh token in the body; the web app uses an HttpOnly cookie. */
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});

export const TokenRequestSchema = z.object({
  token: z.string().min(20).max(200),
});

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: PasswordSchema,
});

/**
 * Closing an account needs the password again, so a borrowed unlocked phone cannot do it.
 * Accounts that only sign in with Google or Apple have no password: they type DELETE instead.
 */
export const DeleteAccountRequestSchema = z
  .object({
    password: z.string().min(1).max(128).optional(),
    confirm: z.literal('DELETE').optional(),
  })
  .refine((body) => body.password !== undefined || body.confirm !== undefined, {
    message: 'Enter your password, or type DELETE to confirm',
  });

// ── Sign in with Google / Apple ──

export const SocialProviderSchema = z.enum(['google', 'apple']);

export const SocialSignInRequestSchema = z.object({
  provider: SocialProviderSchema,
  /** The ID token (JWT) from Google Identity Services or Sign in with Apple. */
  idToken: z.string().min(20).max(8_000),
  /** The nonce the app put in the sign-in request; checked against the token. */
  nonce: z.string().min(16).max(200).optional(),
  /** Apple shares the name only on the very first sign-in, outside the token. */
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  deviceName: DeviceNameSchema,
});

/** Public client ids the apps need to show each button; null when a provider is not set up. */
export const SocialProvidersResponseSchema = z.object({
  google: z
    .object({
      webClientId: z.string().nullable(),
      iosClientId: z.string().nullable(),
      androidClientId: z.string().nullable(),
    })
    .nullable(),
  apple: z.object({ servicesId: z.string().nullable() }).nullable(),
});

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});

/** A 6-digit TOTP code, or a recovery code like "7KQ2-M9XD-4TPA". */
export const MfaCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/, {
    message: 'Enter the 6-digit code from your authenticator app or a recovery code.',
  });

export const MfaCodeRequestSchema = z.object({ code: MfaCodeSchema });

export const MfaChallengeRequestSchema = z.object({
  mfaToken: z.string().min(20),
  code: MfaCodeSchema,
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresIn: z.number().int().positive(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
  sessionId: z.uuid(),
});

export const MfaRequiredSchema = z.object({
  mfaRequired: z.literal(true),
  mfaToken: z.string(),
});

export const LoginResponseSchema = z.union([AuthTokensSchema, MfaRequiredSchema]);

export const MeResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  emailVerified: z.boolean(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  mfaEnabled: z.boolean(),
  /** False for accounts that only sign in with Google or Apple. */
  hasPassword: z.boolean(),
  /** Google / Apple accounts linked for sign-in. */
  linkedProviders: z.array(z.enum(['google', 'apple'])),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

export const SessionSummarySchema = z.object({
  id: z.uuid(),
  deviceName: z.string().nullable(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  current: z.boolean(),
  mfaVerified: z.boolean(),
});

export const MfaSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
});

export const MfaEnabledResponseSchema = z.object({
  recoveryCodes: z.array(z.string()).length(10),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type TokenRequest = z.infer<typeof TokenRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
export type MfaCodeRequest = z.infer<typeof MfaCodeRequestSchema>;
export type MfaChallengeRequest = z.infer<typeof MfaChallengeRequestSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type MfaRequired = z.infer<typeof MfaRequiredSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type SocialProvider = z.infer<typeof SocialProviderSchema>;
export type SocialSignInRequest = z.infer<typeof SocialSignInRequestSchema>;
export type SocialProvidersResponse = z.infer<typeof SocialProvidersResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type MfaSetupResponse = z.infer<typeof MfaSetupResponseSchema>;
export type MfaEnabledResponse = z.infer<typeof MfaEnabledResponseSchema>;
