import { MailService } from '@/mail/mail.service.js';
import { Module } from '@nestjs/common';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
