export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailProvider {
  testConnection(): Promise<void>;
  sendMail(message: MailMessage): Promise<void>;
  close(): void;
}
