import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import authController from '#controller/auth.controller.js';
import authService from '#services/auth.service.js';

vi.mock('#services/auth.service.js', () => ({ default: { register: vi.fn() } }));

const body = { email: 'a@example.com', password: 'Passw0rd!' };

describe('AuthController.register', () => {
  it('registers the request body and responds with success', async () => {
    vi.mocked(authService.register).mockResolvedValue(undefined);
    const json = vi.fn();
    const next = vi.fn<(err?: unknown) => void>();

    await authController.register({ body } as Request, { json } as unknown as Response, next);

    expect(authService.register).toHaveBeenCalledWith(body);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: 'Registered successfully',
      data: null,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards service errors to next without responding', async () => {
    const err = new Error('fail');
    vi.mocked(authService.register).mockRejectedValue(err);
    const json = vi.fn();
    const next = vi.fn<(err?: unknown) => void>();

    await authController.register({ body } as Request, { json } as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(json).not.toHaveBeenCalled();
  });
});
