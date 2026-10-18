# Agentify API

Backend for Agentify. It started as a plain Express + TypeScript + Prisma app with a bunch of custom middlewares, and I moved it to NestJS. Mostly to learn Nest properly, and partly because typing stuff like `req.body` through Express middlewares got annoying real quick.

Same features as the old one, a couple of bugs fixed on the way.

## Stack

NestJS 12 on Express 5, Prisma 8 (the new contract based one, not Prisma 7), Postgres, Redis for cache, BullMQ for background jobs, Zod for validation, Vitest for tests. Node 24, ESM, npm only.

## Running it locally

Node 24, a Postgres database and Redis. Then:

```bash
npm install
cp .env.example .env    # fill in the real values
npx prisma db migrate   # creates the tables
npm run dev             # API on http://localhost:5000/api
npm run dev:worker      # in another terminal, runs the background jobs
```

The app won't even boot if the env is wrong or the DB / Redis / SMTP isn't reachable. That's on purpose, I'd rather it die at startup than half work.

Quick check that it's alive:

```bash
curl localhost:5000/api/health
```

## API and worker

There are two processes:

- **API** (`src/main.ts`): the HTTP server. Everything is under `/api`.
- **Worker** (`src/worker.ts`): no port, no HTTP. It just pulls jobs off the Redis queue (emails, the hourly cleanup, builds later) and runs them.

They never talk to each other directly. The API drops a job in Redis, the worker picks it up. You can run as many workers as you want.

## Routes so far

| Method | Route                    | What it does                                  |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/api/health`            | is the server up                              |
| POST   | `/api/auth/register`     | create an account, sends a verification email |
| POST   | `/api/auth/verify-email` | `?key=<token>` from the email link            |
| POST   | `/api/auth/login`        | sets the auth + refresh cookies               |
| POST   | `/api/auth/logout`       | needs to be logged in, kills the session      |

Every response looks like `{ success, message, data }`. Errors are `{ success: false, message }`.

One session per user. Logging in somewhere else kicks out the old session right away, it doesn't wait for the token to expire.

## Folder layout

It's split by feature, the usual Nest way. Each folder has its own module, service, controller etc.

```
src/
  auth/        register, login, logout, verify email, guard, cookies, sessions
  users/       user table stuff
  chores/      single use tokens (email verification for now)
  cache/       Redis cache
  queue/       BullMQ queue + job types
  worker/      the worker process (job processor)
  mail/        SMTP + email templates
  database/    Prisma client + the contract
  health/      health check
  common/      filter, pipe, interceptor, logger... the shared plumbing
  config/      env validation
```

## Scripts

```bash
npm run dev            # API with watch
npm run dev:worker     # worker with watch
npm run check          # prettier + oxlint + typecheck, run this before pushing
npm test               # all tests
npm run test:unit      # just the unit tests, takes like a second
npm run prisma:generate   # after editing contract.prisma
```

For a schema change: edit `src/database/prisma/contract.prisma`, run `npm run prisma:generate`, then `npx prisma migration plan --name what_changed` and `npx prisma db migrate`.

## Todo

- e2e tests with Testcontainers
- Dockerfile + compose
- `/refresh` endpoint (refresh tokens are already issued and stored, nothing uses them yet)
- rename the `temporary_tasks` table to `chores`

## Notes for AI agents

If you're an agent working on this repo, read `AGENTS.md` first. All the rules are there.
