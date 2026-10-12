# Agentify backend

Node 24 (ESM, NodeNext) · TypeScript strict · Express 5 · Prisma 8 RC (`@prisma/orm-postgres`, contract-based) · PostgreSQL · BullMQ + ioredis · Redis cache · Zod 4 · winston · Vitest · npm only

<!-- Canonical rules for every coding agent. CLAUDE.md imports this file; don't duplicate rules elsewhere. Keep under ~150 lines. -->

## Commands

- **Definition of done:** `npm run check && npm test` passes. Paste the output; "should work" is not done.
- Typecheck `npm run typecheck` (src + tests) · Lint `npm run lint` (`lint:fix` to autofix) · Format `npm run format`
- Tests: `npm run test:unit` (no Docker, ~1s) · `npm run test:integration` (needs Docker) · single file `npx vitest run tests/path/file.test.ts`
- If Docker isn't available, say so and report the unit results; don't skip or stub integration tests.
- Dev: `npm run dev` (API) · `npm run dev:worker` (BullMQ worker)
- After editing `src/prisma/contract.prisma`: `npm run prisma:generate`, then `npm run typecheck`
- If `node`/`npm` is not found, the shell didn't load nvm: run `. ~/.nvm/nvm.sh && nvm use`. Do not install or switch Node versions.
- If you are writing some code and a parameter or a function states its depricated then don't use it, never, find its alternative and use it.

## Prisma 8: this is NOT Prisma 7

**Before any DB task, read `node_modules/@prisma/orm-postgres/skills/prisma-8/SKILL.md`** and the reference it routes to. It matches the installed version; trust it over memory.

| Prisma 7 (never use)                              | Prisma 8 (this repo)                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `@prisma/client`, `PrismaClient`, `schema.prisma` | `db` / `dbInstance` from `#providers/db.provider.js`, `src/prisma/contract.prisma`                                                  |
| `findUnique` / `findFirst`                        | `db.public.User.first({ email })` or `.where({ id }).first()`                                                                       |
| `findMany`                                        | `.where({...}).all().toArray()` (or `for await` to stream)                                                                          |
| `$transaction`                                    | `dbInstance.transaction(async (tx) => { ... tx.orm ... })`                                                                          |
| `$queryRaw` / `$executeRaw`                       | `dbInstance.runtime().execute(dbInstance.raw.sql\`...${v}\`.affectedCount().build())`; rows: `.returnsRow({...})`+`runtime().query` |
| `P2002` error code                                | `isUniqueViolation(error)` from `#utils/errorGuards.js` (SQLSTATE `23505`)                                                          |
| `prisma generate`, `migrate dev/deploy/reset`     | `prisma contract emit`, `prisma migration plan`, `prisma db migrate`                                                                |
| generated TS `enum` objects                       | type: `Models.public_X['field']`; values: `dbInstance.enums.public.X.values`                                                        |

- Models are namespaced: `db.public.User`, never `db.User`.
- `update()` / `delete()` require a prior `.where(...)` and return the row or `null`.
- `src/prisma/contract.json` and `contract.d.ts` are **generated**. Never hand-edit; regenerate and commit all three contract files together.
- `DateTime` fields are Temporal values, not `Date`. Check the skill's contract reference before writing date code.

## Data and transactions

- Any operation with more than one write goes in `dbInstance.transaction`. Services take an optional trailing `orm: Orm` argument; pass `tx.orm` through. Inside the callback, never use `db` (it runs outside the transaction on another connection).
- No side effects inside a transaction: enqueue jobs, send email and write cache **after** it commits (see `authService.register`).
- Enforce invariants in the DB (`@unique`, FKs) and handle the violation; don't rely on check-then-insert.
- Raw SQL only through the `raw.sql` tagged template. Never build SQL with string concatenation; whitelist any dynamic identifier.

## TypeScript and code style

ESLint (`strictTypeChecked`) and `tsconfig.json` are authoritative. Fix the code, never the checker.

- No `any`, no non-null `!`, no `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`. Use `unknown` and narrow.
- `as` only right after validation (e.g. Zod parse). Prefer `satisfies` for typed literals.
- Exhaustive `switch` over unions with a `const _exhaustive: never = x` default, or a `Record<Union, ...>` map.
- Derive types instead of duplicating them: `z.infer<typeof schema>`, `CreateInput<Contract, 'Model'>`, `Models.public_X`.
- Imports: `#*` aliases for all project modules (relative imports are lint errors), `.js` extensions, `node:` prefix for builtins, `import type` for types.
- No TS `enum`, namespaces, decorators or parameter properties in new code; use `as const` objects or unions.
- Explicit return types on exported/public functions.
- Logging via `logger` from `#utils/logger.js`; `console.*` is banned. Never log passwords, tokens, OTPs, `DATABASE_URL` or full request bodies.
- Follow existing patterns: controller → service → `db`; validation schemas in `src/validationSchemas/`; types in `src/types/`. Reuse an existing helper before writing a new one.

## Node / Express / BullMQ

- Validate every external input with Zod at the boundary: env (`env.schema.ts`), body/params/query (validation middleware), and `job.data` in workers.
- Express 5 forwards async rejections automatically: no `asyncHandler` wrappers, no try/catch that only re-throws. Throw `HttpException` for client errors; let the error middleware respond.
- Never swallow errors: rethrow, or log with context and rethrow.
- No `*Sync` fs/crypto calls in request or job paths. Use `crypto.randomBytes` for tokens, never `Math.random`.
- BullMQ jobs: idempotent, carry IDs not PII, deterministic `jobId` where duplicates are possible, processors throw `Error` objects. Never set ioredis `keyPrefix` on BullMQ connections.
- Keep graceful shutdown working: anything that opens a connection must be closed in the shutdown path.

## Tests

Vitest with two projects in `vitest.config.ts`. Mirror `src/` paths: `src/services/x.ts` → `tests/unit/services/x.test.ts`.

|         | Unit (`tests/unit/**`)                                                                          | Integration (`tests/integration/**`)                                                           |
| ------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tests   | One module's logic: branches, errors, edge cases                                                | Real SQL, constraints, transactions, Redis, HTTP routes                                        |
| I/O     | None. `vi.mock` every `#services/*` / `#providers/*` the module imports, or inject a fake `Orm` | Real Postgres + Redis from Testcontainers (`globalSetup.ts`); mail never sent (no worker runs) |
| Example | `tests/unit/services/auth.service.test.ts`                                                      | `tests/integration/auth.test.ts` (supertest on `app`)                                          |

- Env comes from `vitest.config.ts` (`testEnv`), never `.env`. Service URLs point at port 1, so a unit test that forgets a mock fails fast. New required env vars must be added to `testEnv` too.
- Integration: `setup.ts` truncates all `public` tables and flushes Redis before **every** test. Create the data each test needs inside that test; never rely on order or on data from another test. Files run serially.
- Import app code statically in test files (env is set before they load). Only `tests/integration/setup.ts` needs dynamic imports.
- Assert on outcomes (DB rows, HTTP status/body, calls to mocked boundaries), not on internals. Test DB behaviour against the real DB, never by mocking `where().first()` chains.
- Every bug fix gets a regression test that fails without the fix.
- Mocks reset automatically between tests (`mockReset`); set return values in each test or `beforeEach`.
- Debug noisy failures with `LOG_IN_TESTS=1 npx vitest run ...` (the logger is silent under `APP_ENV=test`).
- Never delete, `.skip`, `.only` or weaken an assertion to make a test pass. Never point tests at a non-container database.

## Boundaries

### Always

- Read the code a change touches and grep all callers before editing. Fix root causes with the smallest diff that does it.
- Run the definition-of-done command and report real output, including failures.
- Keep `.env.example` and `env.schema.ts` in sync when adding config.

### Ask first

- Editing `contract.prisma`, or creating/applying any migration. Show the `prisma migration plan` output and flag destructive ops before applying.
- Adding, removing or upgrading dependencies (including Prisma RC bumps).
- Changing `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `.lintstagedrc`, `.husky/`, `package.json` scripts, Dockerfile, CI.
- Changing an API route's request/response shape, or any auth, session, password or token logic.
- Renaming/moving files or large refactors beyond the task.

### Never

- **IMPORTANT: never run destructive DB commands** (`prisma db update` / `npm run db:push`, `prisma db migrate`, `--confirm`, `DROP`, `TRUNCATE`, mass `DELETE`/`UPDATE`) without explicit approval in this conversation, and never against a non-local `DATABASE_URL`. Never set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` or self-approve any guardrail prompt.
- Hand-edit generated or applied files: `src/prisma/contract.json`, `contract.d.ts`, applied migration packages / `ops.json`, `dist/`, `node_modules/`.
- Read, print, log or commit `.env` or any secret, token or connection string.
- Disable or loosen a lint rule, tsconfig flag or test to get green. `eslint-disable` only with `-- reason` and approval.
- `git push --force`, `git reset --hard`, `git clean -fd`, `rm -rf`, `--no-verify`, committing to `main`, or rewriting published history.
- Use `npx` to install packages, or use pnpm/yarn.

Hooks and lint rules are guardrails. If one blocks you, stop and report it; do not work around it.
