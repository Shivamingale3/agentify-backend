import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const transporter = { verify: vi.fn(), sendMail: vi.fn(), close: vi.fn() };
  return { transporter, createTransport: vi.fn(() => transporter) };
});

vi.mock('nodemailer', () => ({ default: { createTransport: fake.createTransport } }));
vi.mock('#providers/env.provider.js', () => ({
  env: {
    APP_ENV: 'test',
    EMAIL_HOST: 'smtp.test',
    EMAIL_PORT: 587,
    EMAIL_USER: 'mailer@example.com',
    EMAIL_PASSWORD: 'mail-pass',
    EMAIL_FROM: 'App <noreply@example.com>',
  },
}));

async function load() {
  vi.resetModules();
  const { default: provider } = await import('#providers/mail.provider.js');
  return provider;
}

let provider: Awaited<ReturnType<typeof load>>;

beforeEach(async () => {
  provider = await load();
});

describe('NodeMailerProvider', () => {
  it('creates a pooled transport that requires TLS', () => {
    expect(fake.createTransport).toHaveBeenCalledExactlyOnceWith({
      host: 'smtp.test',
      port: 587,
      auth: { user: 'mailer@example.com', pass: 'mail-pass' },
      secure: false,
      requireTLS: true,
      pool: true,
      maxConnections: 3,
    });
  });

  it('testConnection verifies the transport', async () => {
    await provider.testConnection();

    expect(fake.transporter.verify).toHaveBeenCalledOnce();
  });

  it('testConnection rethrows Error and non-Error failures unchanged', async () => {
    const error = new Error('auth failed');
    fake.transporter.verify.mockRejectedValueOnce(error);
    await expect(provider.testConnection()).rejects.toBe(error);

    fake.transporter.verify.mockRejectedValueOnce('boom');
    await expect(provider.testConnection()).rejects.toBe('boom');
  });

  it('sendMail sends from EMAIL_FROM', async () => {
    await provider.sendMail({ to: 'a@example.com', subject: 'S', text: 'T', html: '<b>T</b>' });

    expect(fake.transporter.sendMail).toHaveBeenCalledWith({
      from: 'App <noreply@example.com>',
      to: 'a@example.com',
      subject: 'S',
      text: 'T',
      html: '<b>T</b>',
    });
  });

  it('sendMail rethrows Error and non-Error failures unchanged', async () => {
    const error = new Error('rejected');
    fake.transporter.sendMail.mockRejectedValueOnce(error);
    await expect(provider.sendMail({ to: 'a@example.com', subject: 'S', text: 'T' })).rejects.toBe(
      error,
    );

    fake.transporter.sendMail.mockRejectedValueOnce('boom');
    await expect(provider.sendMail({ to: 'a@example.com', subject: 'S', text: 'T' })).rejects.toBe(
      'boom',
    );
  });

  it('close closes the pooled transport', () => {
    provider.close();

    expect(fake.transporter.close).toHaveBeenCalledOnce();
  });
});
