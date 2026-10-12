import { describe, expect, it, vi } from 'vitest';
import nodeMailerProvider from '#providers/mail.provider.js';
import mailService from '#services/mail.service.js';

vi.mock('#providers/mail.provider.js', () => ({
  default: { testConnection: vi.fn(), sendMail: vi.fn(), close: vi.fn() },
}));

const message = { to: 'a@example.com', subject: 'Hi', text: 'hello', html: '<p>hello</p>' };

describe('MailService', () => {
  it('checkConnection tests the provider connection and propagates failures', async () => {
    await mailService.checkConnection();
    expect(nodeMailerProvider.testConnection).toHaveBeenCalledOnce();

    vi.mocked(nodeMailerProvider.testConnection).mockRejectedValue(new Error('smtp down'));
    await expect(mailService.checkConnection()).rejects.toThrow('smtp down');
  });

  it('sendMail forwards the message', async () => {
    await mailService.sendMail(message);

    expect(nodeMailerProvider.sendMail).toHaveBeenCalledWith(message);
  });

  it('sendMail propagates provider errors', async () => {
    const error = new Error('rejected');
    vi.mocked(nodeMailerProvider.sendMail).mockRejectedValue(error);

    await expect(mailService.sendMail(message)).rejects.toBe(error);
  });

  it('sendActivationMail rethrows Error and non-Error failures unchanged', async () => {
    const error = new Error('smtp down');
    vi.mocked(nodeMailerProvider.testConnection).mockRejectedValueOnce(error);
    await expect(mailService.sendActivationMail()).rejects.toBe(error);

    vi.mocked(nodeMailerProvider.testConnection).mockRejectedValueOnce('boom');
    await expect(mailService.sendActivationMail()).rejects.toBe('boom');
  });

  it('shutdown closes the provider', () => {
    mailService.shutdown();

    expect(nodeMailerProvider.close).toHaveBeenCalledOnce();
  });
});
