import { describe, expect, it, vi } from 'vitest';
import mailService from '#services/mail.service.js';
import { logger } from '#utils/logger.js';
import { emailWorker } from '#workers/email.worker.js';

vi.mock('#services/mail.service.js', () => ({ default: { sendMail: vi.fn() } }));

const job = {
  id: '1',
  name: 'email',
  attemptsMade: 0,
  data: { to: 'a@example.com', subject: 'S', text: 'T', html: '<b>T</b>' },
};

describe('emailWorker', () => {
  it('sends the job data as the mail message', async () => {
    await emailWorker(job);

    expect(mailService.sendMail).toHaveBeenCalledWith(job.data);
  });

  it('rethrows send failures so the queue retries', async () => {
    const error = new Error('smtp down');
    vi.mocked(mailService.sendMail).mockRejectedValue(error);

    await expect(emailWorker(job)).rejects.toBe(error);
  });

  // Logs identify the job; the recipient stays in BullMQ, out of the logs.
  it('logs the job id and never the recipient address', async () => {
    const info = vi.spyOn(logger, 'info');
    const error = vi.spyOn(logger, 'error');
    await emailWorker(job);
    vi.mocked(mailService.sendMail).mockRejectedValue(new Error('smtp down'));
    await expect(emailWorker(job)).rejects.toThrow('smtp down');

    const logged = JSON.stringify([...info.mock.calls, ...error.mock.calls]);
    expect(logged).toContain(job.id);
    expect(logged).not.toContain(job.data.to);
  });
});
