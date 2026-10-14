import { defineConfig } from 'vitest/config';

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
  AUTH_COOKIE_NAME: 'agentify-auth',
  AUTH_EXPIRY: '86400',
  REFRESH_COOKIE_NAME: 'agentify-refresh',
  REFRESH_EXPIRY: '604800',
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    env: testEnv,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
    },
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      { extends: true, test: { name: 'e2e', include: ['test/**/*.e2e-spec.ts'] } },
    ],
  },
});
