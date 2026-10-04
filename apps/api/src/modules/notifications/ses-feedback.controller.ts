import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { type Env } from '../../config/env';
import { Public } from '../identity/guards/decorators';
import { EmailSuppressionService } from './email-suppression.service';
import { isSnsUrl, parseSnsMessage, sesFeedback, verifySnsSignature } from './sns-message';

const certificates = new Map<string, Promise<string>>();

/** SNS signing certificates, fetched once per URL (only from SNS's own hosts). */
function certificate(url: string): Promise<string> {
  let pem = certificates.get(url);
  if (!pem) {
    pem = fetch(url, { signal: AbortSignal.timeout(5_000) }).then((res) => {
      if (!res.ok) throw new Error(`certificate ${res.status}`);
      return res.text();
    });
    pem.catch(() => certificates.delete(url));
    certificates.set(url, pem);
  }
  return pem;
}

/**
 * SES → SNS → NIXZORA: permanent bounces and spam complaints (p9-02). Every message must be
 * signed by SNS and come from our own topic; anything else is refused.
 */
@ApiTags('notifications')
@Controller({ path: 'notifications/webhooks', version: '1' })
export class SesFeedbackController {
  private readonly logger = new Logger(SesFeedbackController.name);
  private readonly topicArn?: string;

  constructor(
    private readonly suppressions: EmailSuppressionService,
    config: ConfigService<Env, true>,
  ) {
    this.topicArn = config.get('SES_EVENTS_TOPIC_ARN', { infer: true });
  }

  @Post('ses')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async ses(@Body() body: unknown): Promise<{ received: true; result: string }> {
    if (!this.topicArn) throw new ForbiddenException('SES feedback is not set up.');
    let json: unknown = body;
    if (typeof body === 'string') {
      try {
        json = JSON.parse(body);
      } catch {
        throw new BadRequestException('Not an SNS message.');
      }
    }
    const message = parseSnsMessage(json);
    if (!message) throw new BadRequestException('Not an SNS message.');
    if (message.TopicArn !== this.topicArn) throw new ForbiddenException('Unknown topic.');
    if (!isSnsUrl(message.SigningCertURL, /^\/SimpleNotificationService-[^/]+\.pem$/)) {
      throw new ForbiddenException('Untrusted signing certificate.');
    }
    const pem = await certificate(message.SigningCertURL).catch(() => null);
    if (!pem || !verifySnsSignature(message, pem)) {
      throw new ForbiddenException('Invalid SNS signature.');
    }

    if (message.Type === 'SubscriptionConfirmation') {
      // Terraform subscribes this endpoint; confirming proves we can receive the topic.
      if (!isSnsUrl(message.SubscribeURL)) throw new ForbiddenException('Untrusted subscribe URL.');
      await fetch(message.SubscribeURL!, { signal: AbortSignal.timeout(5_000) });
      this.logger.log(`Confirmed the SNS subscription to ${message.TopicArn}.`);
      return { received: true, result: 'subscribed' };
    }
    if (message.Type !== 'Notification') return { received: true, result: 'ignored' };

    const feedback = sesFeedback(message.Message);
    if (!feedback || !feedback.addresses.length) return { received: true, result: 'ignored' };
    const added = await this.suppressions.suppress(
      feedback.addresses,
      feedback.kind,
      feedback.detail,
      feedback.template,
    );
    return { received: true, result: added ? 'suppressed' : 'duplicate' };
  }
}
