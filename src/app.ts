import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './middlewares/error.middleware.js';
import { globalRateLimiter } from './middlewares/rateLimiting.middleware.js';
import { notFoundHandler } from './middlewares/notFound.middleware.js';
import { router } from './routes/index.routes.js';
import { morganStream } from './utils/logger.js';

export const app = express();

// nginx (the frontend container) fronts this backend and sets
// X-Forwarded-* headers. Without `trust proxy`, express-rate-limit's
// xForwardedForHeader validation crashes the route on every reverse-proxied
// request. `1` trusts exactly one hop (the nginx container).
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

app.use(globalRateLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan('dev', { stream: morganStream }));

app.use('/api', router);

app.use(notFoundHandler);
app.use(errorHandler);
