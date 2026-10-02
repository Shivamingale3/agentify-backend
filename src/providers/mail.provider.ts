import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '#providers/env.provider.js';
import { logger } from '#utils/logger.js';
import type { MailProvider } from '#interfaces/mail.interfaces.js';

class NodeMailerProvider implements MailProvider {
  private transporter: Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
      secure: false,
      // Never fall back to plaintext: STARTTLS must succeed on 587.
      requireTLS: true,
      // Reuse SMTP connections instead of a new TCP+TLS handshake per email.
      pool: true,
      maxConnections: 3,
    });
  }

  async testConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('✅ SMTP Connection Successful');
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Failed to send Email: ${error.message}`);
        throw error;
      }
      logger.error(`Failed to send Email:`, error);
      throw error;
    }
  }

  async sendMail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Failed to send Email: ${error.message}`);
        throw error;
      }
      logger.error(`Failed to send Email:`, error);
      throw error;
    }
  }

  close(): void {
    // Closes the pooled SMTP connections.
    this.transporter.close();
    logger.info('🛑 SMTP connections closed');
  }
}

const nodeMailerProvider = new NodeMailerProvider();
export default nodeMailerProvider;
