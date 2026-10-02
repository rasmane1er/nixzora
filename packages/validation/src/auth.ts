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

/** Closing an account needs the password again, so a borrowed unlocked phone cannot do it. */
export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(128),
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
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type MfaSetupResponse = z.infer<typeof MfaSetupResponseSchema>;
export type MfaEnabledResponse = z.infer<typeof MfaEnabledResponseSchema>;
