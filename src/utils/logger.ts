import winston from 'winston';
import { env } from '../config/env.config.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp as string} [${level}]: ${String(stack ?? message)}`;
  }),
);

// Custom log format for production
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.APP_ENV === 'development' ? 'debug' : 'info',
  format: env.APP_ENV === 'development' ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
});

// Stream for morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
