import { Global, Module } from '@nestjs/common';
import { EmailSuppressionService } from './email-suppression.service';
import { MailService } from './mail.service';
import { SesFeedbackController } from './ses-feedback.controller';

@Global()
@Module({
  controllers: [SesFeedbackController],
  providers: [MailService, EmailSuppressionService],
  exports: [MailService, EmailSuppressionService],
})
export class NotificationsModule {}
