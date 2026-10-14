import winston from 'winston';
import { env } from '#providers/env.provider.js';

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

// Custom log format for development
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(), // fills %s / %d placeholders from the extra logger arguments
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp as string} [${level}]: ${String(stack ?? message)}`;
  }),
);

// Custom log format for production
const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

export const logger = winston.createLogger({
  level: env.APP_ENV === 'development' ? 'debug' : 'info',
  // Keep test output readable; set LOG_IN_TESTS=1 to debug a failing test.
  silent: env.APP_ENV === 'test' && !process.env['LOG_IN_TESTS'],
  format: env.APP_ENV === 'development' ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
});

// Stream for morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
