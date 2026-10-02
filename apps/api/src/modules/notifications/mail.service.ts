import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML version; the text version is always sent too. */
  html?: string;
  /** Machine-readable template id, e.g. "auth.verify-email". */
  template: string;
  /** Values used by the template, e.g. the link to click. */
  data: Record<string, string>;
};

/**
 * Outgoing email. "log" (development) prints messages and keeps the last few in memory for
 * tests; "ses" sends through Amazon SES. Callers never know which one is active.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly recent: MailMessage[] = [];
  private readonly ses?: SESv2Client;

  constructor(private readonly config: ConfigService<Env, true>) {
    if (config.get('MAIL_DRIVER', { infer: true }) === 'ses') {
      this.ses = new SESv2Client({ region: config.get('SES_REGION', { infer: true }) });
    }
  }

  async send(message: MailMessage): Promise<void> {
    this.recent.push(message);
    if (this.recent.length > 50) this.recent.shift();

    if (this.ses) {
      await this.ses.send(
        new SendEmailCommand({
          FromEmailAddress: this.config.get('MAIL_FROM', { infer: true }),
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: message.text, Charset: 'UTF-8' },
                ...(message.html ? { Html: { Data: message.html, Charset: 'UTF-8' } } : {}),
              },
            },
          },
          EmailTags: [
            { Name: 'template', Value: message.template.replace(/[^A-Za-z0-9_-]/g, '_') },
          ],
        }),
      );
      return;
    }

    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      // Never log message bodies in production: they contain single-use tokens.
      this.logger.warn(`No email provider configured; "${message.template}" was not delivered.`);
      return;
    }
    this.logger.log(`[dev mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }

  /** Test helper: the most recent message sent to an address. */
  lastTo(address: string, template?: string): MailMessage | undefined {
    return [...this.recent]
      .reverse()
      .find((message) => message.to === address && (!template || message.template === template));
  }
}
