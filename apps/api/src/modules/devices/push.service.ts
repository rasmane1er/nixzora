import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type PushData } from '@nixzora/validation';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

export type PushMessage = { title: string; body: string; data: PushData };

type ExpoTicket =
  { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const CHUNK = 100;

/**
 * Push notifications to the mobile app through Expo's push service (which relays to APNs and
 * FCM). "log" (development and tests) only records messages. Delivery is best-effort: a failure
 * is logged and never fails the caller, so an order email is not re-sent because a push failed.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly recent: (PushMessage & { to: string })[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async sendToUser(userId: string, message: PushMessage): Promise<number> {
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId },
      select: { token: true },
    });
    if (!devices.length) return 0;
    const tokens = devices.map((device) => device.token);

    if (this.config.get('PUSH_DRIVER', { infer: true }) === 'log') {
      for (const to of tokens) this.recent.push({ ...message, to });
      this.recent.splice(0, Math.max(0, this.recent.length - 50));
      if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
        this.logger.log(
          `[dev push] ${tokens.length} device(s): ${message.title} — ${message.body}`,
        );
      }
      return tokens.length;
    }

    let sent = 0;
    for (let start = 0; start < tokens.length; start += CHUNK) {
      sent += await this.sendChunk(tokens.slice(start, start + CHUNK), message);
    }
    return sent;
  }

  private async sendChunk(tokens: string[], message: PushMessage): Promise<number> {
    const accessToken = this.config.get('EXPO_ACCESS_TOKEN', { infer: true });
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: 'default',
            channelId: 'orders',
          })),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`Expo push rejected the request (${response.status}).`);
        return 0;
      }
      const { data } = (await response.json()) as { data: ExpoTicket[] };
      const gone = tokens.filter(
        (_, index) =>
          data[index]?.status === 'error' &&
          (data[index] as { details?: { error?: string } }).details?.error ===
            'DeviceNotRegistered',
      );
      if (gone.length) {
        // The app was uninstalled or notifications were turned off: stop sending to it.
        await this.prisma.pushDevice.deleteMany({ where: { token: { in: gone } } });
      }
      return data.filter((ticket) => ticket.status === 'ok').length;
    } catch (error) {
      this.logger.warn(`Expo push failed: ${(error as Error).message}`);
      return 0;
    }
  }

  /** Test helper: messages recorded by the "log" driver for a device token. */
  sentTo(token: string): PushMessage[] {
    return this.recent.filter((message) => message.to === token);
  }
}
