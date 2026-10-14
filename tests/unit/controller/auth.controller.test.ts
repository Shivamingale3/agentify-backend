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
    const status = vi.fn(() => ({ json }));

    await authController.register({ body } as Request, { status, json } as unknown as Response);

    expect(authService.register).toHaveBeenCalledWith(body);
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: 'Registered successfully',
      data: null,
    });
  });

  // Express 5 forwards a rejected handler to the error middleware, so the controller just rejects.
  it('rejects with the service error without responding', async () => {
    const err = new Error('fail');
    vi.mocked(authService.register).mockRejectedValue(err);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await expect(
      authController.register({ body } as Request, { status, json } as unknown as Response),
    ).rejects.toBe(err);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
