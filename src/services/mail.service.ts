import type { MailProvider } from '#interfaces/mail.interfaces.js';
import nodeMailerProvider from '#providers/mail.provider.js';
import { logger } from '#utils/logger.js';

class MailService {
  private emailer: MailProvider;
  constructor(emailer: MailProvider) {
    this.emailer = emailer;
  }

  async checkConnection(): Promise<void> {
    await this.emailer.testConnection();
  }
  async sendActivationMail(): Promise<void> {
    try {
      await this.emailer.testConnection();
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Failed to send activation email: ${error.message}`);
        throw error;
      }
      logger.error(`Failed to send Email:`, error);
      throw error;
    }
  }

  /** Graceful shutdown — call on SIGTERM / SIGINT. */
  shutdown(): void {
    this.emailer.close();
  }
}
const mailService = new MailService(nodeMailerProvider);
export default mailService;
