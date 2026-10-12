import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerShutdown, settleAll } from '#lib/shutdown.js';
import { logger } from '#utils/logger.js';

const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

describe('registerShutdown', () => {
  let before: Map<string, ReturnType<typeof process.listeners>>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Never let the code under test exit the test runner.
    vi.spyOn(process, 'exit').mockImplementation(vi.fn<() => never>());
    before = new Map(SIGNALS.map((s) => [s, process.listeners(s)]));
  });

  afterEach(() => {
    // Remove any listener registerShutdown added (once-listeners that didn't fire are still there).
    for (const signal of SIGNALS) {
      for (const listener of process.listeners(signal)) {
        if (!before.get(signal)?.includes(listener)) process.removeListener(signal, listener);
      }
    }
    vi.useRealTimers();
  });

  it.each(SIGNALS)('runs cleanup on %s and exits 0', async (signal) => {
    const cleanup = vi.fn(() => Promise.resolve());
    const info = vi.spyOn(logger, 'info');
    registerShutdown(cleanup);

    process.emit(signal, signal);
    await vi.advanceTimersByTimeAsync(0);

    expect(info).toHaveBeenCalledWith(expect.stringContaining(`${signal} received`));
    expect(cleanup).toHaveBeenCalledOnce();
    expect(process.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('exits 1 and logs the message when cleanup rejects with an Error', async () => {
    const error = vi.spyOn(logger, 'error');
    registerShutdown(() => Promise.reject(new Error('redis stuck')));

    process.emit('SIGTERM', 'SIGTERM');
    await vi.advanceTimersByTimeAsync(0);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Shutdown failed: redis stuck'));
    expect(process.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('stringifies a non-Error rejection', async () => {
    const error = vi.spyOn(logger, 'error');
    const reason: unknown = 'plain string';
    registerShutdown(() => Promise.reject(reason));

    process.emit('SIGTERM', 'SIGTERM');
    await vi.advanceTimersByTimeAsync(0);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Shutdown failed: plain string'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('runs cleanup only once when a second signal arrives', async () => {
    const cleanup = vi.fn(() => Promise.resolve());
    registerShutdown(cleanup);

    process.emit('SIGTERM', 'SIGTERM');
    process.emit('SIGINT', 'SIGINT');
    await vi.advanceTimersByTimeAsync(0);

    expect(cleanup).toHaveBeenCalledOnce();
    expect(process.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('forces exit 1 after 10s if cleanup hangs', async () => {
    const error = vi.spyOn(logger, 'error');
    registerShutdown(() => new Promise<void>(() => undefined));

    process.emit('SIGTERM', 'SIGTERM');
    await vi.advanceTimersByTimeAsync(9_999);
    expect(process.exit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('forcing exit'));
    expect(process.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('does nothing until a signal arrives', async () => {
    const cleanup = vi.fn(() => Promise.resolve());
    registerShutdown(cleanup);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(cleanup).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });
});

describe('settleAll', () => {
  it('resolves when every task fulfils (or there are none)', async () => {
    await expect(settleAll([Promise.resolve(1), Promise.resolve()])).resolves.toBeUndefined();
    await expect(settleAll([])).resolves.toBeUndefined();
  });

  it('waits for all tasks, logs every failure, then throws with the count', async () => {
    const error = vi.spyOn(logger, 'error');
    let lateDone = false;
    const late = new Promise<void>((resolve) => {
      setTimeout(() => {
        lateDone = true;
        resolve();
      }, 5);
    });

    await expect(
      settleAll([Promise.reject(new Error('db')), late, Promise.reject(new Error('cache'))]),
    ).rejects.toThrow('2 resource(s) failed to close');

    expect(lateDone).toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Error: db'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Error: cache'));
  });
});
