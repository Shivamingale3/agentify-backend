# Agentify backend

Node 24 (ESM, NodeNext) · TypeScript strict · NestJS 12 (Express 5 adapter) · Prisma 8 RC (`@prisma/orm-postgres`, contract-based) · PostgreSQL · BullMQ (`@nestjs/bullmq`) + ioredis · Redis cache (node-redis) · Zod 4 · oxlint · Vitest · npm only

<!-- Canonical rules for every coding agent. CLAUDE.md imports this file; don't duplicate rules elsewhere. Keep under ~150 lines. -->

## Most Important

- Remember a task handed over is not the end goal, it is just a step to the whole end goal. The end goal is an API for the agentify application that includes the basic APIs like auth, agent CRUD, agent building, message passing, memory, tools, etc. The final API should be well documented and easy to use.

## Commands

- **Definition of done:** `npm run check && npm test` passes. Paste the output; "should work" is not done.
- `npm run check` = format check + `npm run lint` (oxlint, type-aware) + `npm run typecheck`. Autofix: `npm run lint:fix`, `npm run format`.
- Tests: `npm run test:unit` (no Docker, ~1s) · `npm run test:e2e` (needs Docker) · single file `npx vitest run src/path/x.spec.ts`
- If Docker isn't available, say so and report the unit results; don't skip or stub e2e tests.
- Dev: `npm run dev` (API, `/api` prefix) · `npm run dev:worker` (BullMQ worker, separate process, no HTTP)
- After editing `src/database/prisma/contract.prisma`: `npm run prisma:generate`, then `npm run typecheck`
- If `node`/`npm` is not found, the shell didn't load nvm: run `. ~/.nvm/nvm.sh && nvm use`. Do not install or switch Node versions.
- Never use a deprecated API, parameter or option; find its replacement.

## Layout (feature modules, Nest conventions)

`src/<feature>/` holds its `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `guards/`, `decorators/` and colocated `*.spec.ts`. Files are `<name>.<role>.ts`, kebab-case.

- Entry points: `main.ts` (API, `AppModule`) · `worker.ts` (`WorkerModule`, `createApplicationContext`, no port)
- Global, imported once: `ConfigModule` (`config/env/`) and `DatabaseModule` (`@Global()`). Everything else is imported explicitly by the module that uses it (`AuthModule` imports `UsersModule`, `ChoresModule`, `CacheModule`, `QueueModule`). Modules are singletons; importing twice does not create a second instance.
- `common/`: cross-cutting HTTP plumbing only (`AllExceptionsFilter`, `ZodValidationPipe`, `ResponseInterceptor`, `HttpLoggerMiddleware`, `AppLogger`, `createZodDto`, error guards). No business logic.
- `types/`: ambient `.d.ts` only (`temporal.d.ts`, `express.d.ts`). Other types live next to the code they describe.
- Infra modules: `database/`, `cache/`, `mail/`, `queue/`. Feature modules: `health/`, `users/`, `chores/`, `auth/`, `worker/`.

## Prisma 8: this is NOT Prisma 7

**Before any DB task, read `node_modules/@prisma/orm-postgres/skills/prisma-8/SKILL.md`** and the reference it routes to. It matches the installed version; trust it over memory.

| Prisma 7 (never use)                              | Prisma 8 (this repo)                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@prisma/client`, `PrismaClient`, `schema.prisma` | inject `DatabaseService`: `this.db.orm` / `this.db.client`; contract in `src/database/prisma/contract.prisma` |
| `findUnique` / `findFirst`                        | `orm.public.User.first({ email })` or `.where({ id }).first()`                                                |
| `findMany`                                        | `.where({...}).all().toArray()` (or `for await` to stream)                                                    |
| `$transaction`                                    | `this.db.client.transaction(async (tx) => { ... tx.orm ... })`                                                |
| `$queryRaw` / `$executeRaw`                       | `this.db.client.runtime().execute(this.db.client.raw.sql\`...${v}\`.affectedCount().build())`                 |
| `P2002` error code                                | `isUniqueViolation(error)` from `@/common/utils/error-guards.js` (SQLSTATE `23505`)                           |
| `prisma generate`, `migrate dev/deploy/reset`     | `prisma contract emit`, `prisma migration plan --name x`, `prisma db migrate`                                 |
| generated TS `enum` objects                       | type: `Models.public_X['field']`; values: `this.db.client.enums.public.X.values`                              |

- Models are namespaced: `orm.public.User`, never `orm.User`. Model `Chore` maps to table `temporary_tasks`.
- `update()` / `delete()` require a prior `.where(...)` and return the row or `null`.
- `contract.json` and `contract.d.ts` are **generated**. Never hand-edit; regenerate and commit all three contract files together.
- `DateTime` fields are Temporal values, not `Date`. The global is installed in `database.service.ts` (and by `setupFiles` in `vitest.config.ts`), typed by `src/types/temporal.d.ts`; never import `Temporal` from `temporal-polyfill` elsewhere.

## Data and transactions

- More than one write goes in `this.db.client.transaction`. Service methods take an optional trailing `orm: Orm = this.db.orm`; pass `tx.orm` through. Inside the callback never use `this.db.orm` (other connection, outside the transaction).
- No side effects inside a transaction: enqueue jobs, write cache and send mail **after** it commits (see `AuthService.register`). Never run bcrypt inside one.
- Enforce invariants in the DB (`@unique`, FKs) and handle the violation; don't check-then-insert.
- Raw SQL only through the `raw.sql` tagged template. Never concatenate SQL; whitelist dynamic identifiers.

## NestJS rules

- Dependencies come through the constructor. No module-level singletons (`export default new X()`), no global `env` object: read config via `ConfigService<Env, true>` and `config.get('KEY', { infer: true })`.
- Injected classes are **value** imports. `import type` on an injected class erases it, and DI fails with "can't resolve dependencies … Function".
- Input: a `*.dto.ts` holds the Zod schema and `export class XDto extends createZodDto(schema) {}`. Use it as the type of `@Body()`, `@Query()` or `@Param()`; the global `ZodValidationPipe` validates it. Pipes never run on `@Headers()`: write a param decorator that parses them (see `@DeviceHeaders()`).
- Errors: throw Nest exceptions (`UnauthorizedException`, `ConflictException`, …). `AllExceptionsFilter` shapes every error as `{ success: false, message }` and maps DB/Redis/network failures. No try/catch that only logs and rethrows.
- Responses: return the data and set `@ResponseMessage('…')`; `ResponseInterceptor` wraps it as `{ success, message, data }`. `POST` defaults to 201: add `@HttpCode(HttpStatus.OK)` unless it creates something. Use `@Res({ passthrough: true })` only to set cookies.
- Protected routes: `@UseGuards(JwtAuthGuard)` + `@CurrentUser() user: AuthTokenPayload`. The guard rejects tokens whose session is no longer the user's current one (one session per user).
- Rate limits: global 60/min (`ThrottlerGuard`); brute-force targets get `@Throttle(...)`.
- Anything that opens a connection connects in `onModuleInit` (fail boot fast, with a timeout) and closes in `onApplicationShutdown`.
- New job type: add it to `JobPayload` (`queue/jobs.types.ts`) and `jobPayloadSchema`, then a `case` in `JobsProcessor` (compile fails until you do). Jobs carry IDs, not PII; throw `UnrecoverableError` for failures a retry can't fix. The queue key prefix is `agentify`.

## TypeScript and code style

oxlint (`.oxlintrc.json`) and `tsconfig.json` are authoritative. Fix the code, never the checker.

- No `any`, no non-null `!`, no `@ts-ignore` / `@ts-expect-error`. Use `unknown` and narrow.
- `as` only right after validation (Zod parse) or in test fakes. Prefer `satisfies` for typed literals.
- Exhaustive `switch` over unions with a `const x: never = value` default.
- Derive types: `z.infer<typeof schema>`, `CreateInput<Contract, 'Model'>`, `Models.public_X`.
- Imports: `@/` alias for project modules (relative imports are lint errors), `.js` extensions, `node:` prefix for builtins, `import type` for types only (`verbatimModuleSyntax`). Side-effect imports need an `allow` entry in `.oxlintrc.json`.
- Decorators and constructor parameter properties are fine (Nest). No TS `enum` or namespaces in new code.
- Explicit return types on functions and methods.
- Logging: `private readonly logger = new Logger(X.name)`; `console.*` is banned. Never log passwords, tokens, cache keys (they hold session ids and tokens), emails, `DATABASE_URL` or request bodies.
- Reuse an existing helper before writing a new one.

## Tests

Vitest, two projects in `vitest.config.ts`: `unit` (`src/**/*.spec.ts`, colocated) and `e2e` (`test/**/*.e2e-spec.ts`). Globals are on; no `vitest` import needed.

- Unit: construct the class directly with fakes, `new UsersService({ orm: fake } as DatabaseService)`. No `vi.mock` of module paths, no I/O. Fakes cast with `as unknown as X` (allowed in specs only).
- E2E (to be ported): real Postgres + Redis from Testcontainers, HTTP via supertest on the Nest app.
- Env comes from `testEnv` in `vitest.config.ts`, never `.env`; service URLs point at port 1 so a missing fake fails fast. New required env vars go into `testEnv` too.
- Assert outcomes (return values, thrown exceptions, calls to fakes at boundaries), not internals. Every bug fix gets a regression test that fails without the fix.
- Never delete, `.skip`, `.only` or weaken an assertion to make a test pass.

## Boundaries

### Always

- Read the code a change touches and grep all callers before editing. Fix root causes with the smallest diff.
- Run the definition-of-done command and report real output, including failures.
- Keep `.env.example`, `env.schema.ts` and `testEnv` in sync when adding config.

### Ask first

- Editing `contract.prisma`, or creating/applying any migration. Show the `prisma migration plan` output and flag destructive ops before applying.
- Adding, removing or upgrading dependencies (including Prisma RC bumps).
- Changing `tsconfig*.json`, `.oxlintrc.json`, `.prettierrc`, `.lintstagedrc`, `.husky/`, `vitest.config.ts`, `nest-cli.json`, `package.json` scripts, Dockerfile, CI.
- Changing an API route's request/response shape, or any auth, session, cookie, password or token logic.
- Renaming/moving files or refactors beyond the task.

### Never

- **IMPORTANT: never run destructive DB commands** (`prisma db update` / `npm run db:push`, `prisma db migrate`, `--confirm`, `DROP`, `TRUNCATE`, mass `DELETE`/`UPDATE`) without explicit approval in this conversation, and never against a non-local `DATABASE_URL`. Never set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` or self-approve any guardrail prompt.
- Hand-edit generated or applied files: `contract.json`, `contract.d.ts`, `migrations/`, `dist/`, `node_modules/`, `.claude/skills/`, `.agents/skills/` (synced by `prisma skills sync`).
- Read, print, log or commit `.env` or any secret, token or connection string.
- Disable or loosen a lint rule, tsconfig flag or test to get green. `oxlint-disable` only with a reason comment and approval.
- `git push --force`, `git reset --hard`, `git clean -fd`, `rm -rf`, `--no-verify`, committing to `main`, or rewriting published history.
- Use `npx` to install packages, or use pnpm/yarn.

Hooks and lint rules are guardrails. If one blocks you, stop and report it; do not work around it.
