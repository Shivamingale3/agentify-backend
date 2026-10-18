import type { Env } from '@/config/env/env.schema.js';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('EMAIL_FROM', { infer: true });
    this.transporter = createTransport({
      host: config.get('EMAIL_HOST', { infer: true }),
      port: config.get('EMAIL_PORT', { infer: true }),
      auth: {
        user: config.get('EMAIL_USER', { infer: true }),
        pass: config.get('EMAIL_PASSWORD', { infer: true }),
      },
      secure: false,
      // Never fall back to plaintext: STARTTLS must succeed on 587.
      requireTLS: true,
      pool: true,
      maxConnections: 3,
      // The default is 2 minutes: an unreachable SMTP host would stall boot silently.
      connectionTimeout: 5000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.transporter.verify();
    this.logger.log('SMTP connected');
  }

  onApplicationShutdown(): void {
    this.transporter.close();
    this.logger.log('SMTP connections closed');
  }

  async sendMail(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
