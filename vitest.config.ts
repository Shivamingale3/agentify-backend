import { defineConfig } from 'vitest/config';

// A complete, fake env so tests never depend on (or read secrets from) your .env.
// Service URLs point at port 1: a unit test that forgets to mock I/O fails fast instead of
// hitting a real server. Integration tests override them with Testcontainers URLs.
const testEnv = {
  APP_ENV: 'test',
  APP_PORT: '5999',
  APP_URL: 'http://localhost:5999',
  FRONTEND_URL: 'http://localhost:3000',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
  EMAIL_HOST: '127.0.0.1',
  EMAIL_PORT: '1',
  EMAIL_FROM: 'Test <test@example.com>',
  EMAIL_USER: 'test@example.com',
  EMAIL_PASSWORD: 'test',
  CACHE_URL: 'redis://127.0.0.1:1',
  CACHE_PASS: 'test',
  QUEUE_HOST: '127.0.0.1',
  QUEUE_PORT: '1',
  QUEUE_PASS: 'test',
  WORKER_CONCURRENCY: '1',
  JWT_SECRET: 'test-jwt-secret',
};

export default defineConfig({
  // `#*` imports resolve to ./src via the "development" condition, which Vite enables by default outside production.
  test: {
    env: testEnv,
    // Fresh mocks per test: clears calls and resets vi.fn() to its original implementation.
    setupFiles: ['tests/setup.ts'],
    mockReset: true,
    restoreMocks: true,
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/prisma/**'] },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/globalSetup.ts'],
          setupFiles: ['tests/setup.ts', 'tests/integration/setup.ts'],
          // One shared database: run files one at a time so truncation can't race.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
