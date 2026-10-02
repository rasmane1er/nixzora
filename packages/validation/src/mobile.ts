import { z } from 'zod';

/** Expo push token as returned by expo-notifications' getExpoPushTokenAsync(). */
export const ExpoPushTokenSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/, { message: 'Not an Expo push token.' });

export const PushDeviceRegisterSchema = z.object({
  token: ExpoPushTokenSchema,
  platform: z.enum(['ios', 'android']),
});

export const PushDeviceRemoveSchema = z.object({ token: ExpoPushTokenSchema });

/** Sent with every order push so the app can open the right screen when it is tapped. */
export type PushData = { path: string; orderNumber?: string };

export type PushDeviceRegister = z.infer<typeof PushDeviceRegisterSchema>;
export type PushDeviceRemove = z.infer<typeof PushDeviceRemoveSchema>;
