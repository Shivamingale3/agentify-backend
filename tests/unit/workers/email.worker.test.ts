import { describe, expect, it, vi } from 'vitest';
import mailService from '#services/mail.service.js';
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
});
