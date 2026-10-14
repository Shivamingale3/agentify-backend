# Query optimization: auth and cleanup paths

Profiled every query the backend runs, using the SQL the ORM actually generates (captured with a
Prisma 8 `afterQuery` middleware) and `EXPLAIN (ANALYZE, BUFFERS)`. Fixed four issues; each fix has
a test that fails on the old code.

**Setup:** PostgreSQL 17 (Testcontainers), seeded with 100k users, 100k sessions and 200k
verification tasks (half expired), then `ANALYZE`. Timings are medians of 3 runs on local Docker,
where a network round trip costs almost nothing. On a cloud database each saved round trip is
worth about 0.5–1 ms more.

| #   | Change                                          | Before             | After           | Gain                                      |
| --- | ----------------------------------------------- | ------------------ | --------------- | ----------------------------------------- |
| 1   | Expired-token cleanup returns a count, not rows | 2,830 ms           | 124 ms          | **~23× faster**                           |
| 2   | Single-statement update/delete                  | 2 statements       | 1 statement     | **−50% round trips**                      |
| 3   | Login with no transaction                       | 5 statements       | 2 statements    | **−60% round trips**                      |
| 4   | Refresh-session lookup on the primary key       | 4.65 ms (seq scan) | 0.03 ms (index) | **~155× faster, flat as the table grows** |

## 1. Cleanup job: count, don't fetch (~23×)

**Problem:** `deleteAll().toArray()` compiles to `DELETE … RETURNING *`. Every deleted row,
including its JSON payload, was sent to Node and decoded into objects, just to read `.length`.

**Fix:** `deleteAndCount()`, which returns only the affected-row count.

**Why the gap is so large:** inside Postgres the two deletes are close (92 ms vs 44 ms; `RETURNING`
touches 208k vs 108k buffers). The other ~2.7 s was spent sending 100k rows over the wire and
decoding them (JSON, timestamps) in Node. The cost was in the client, which is why the database's
own numbers alone would never have shown it.

## 2. One statement per write (2 → 1)

**Problem:** the ORM's `.where(...).update()` / `.delete()` first runs `SELECT id … LIMIT 1`, then
writes by id, with the id inlined as a literal. That's two round trips, and the literal means each
query text is unique, so a cached query plan can't be reused.

**Fix:** `updateAll().first()` / `deleteAll().first()` / `deleteAndCount()` on unique keys. Each is
one parameterized `UPDATE/DELETE … WHERE key = $1`. The write that verifies an email now takes 2
statements instead of 4.

**Bonus:** it's atomic. A second request using the same one-time token waits on the row lock,
then finds the row gone, so the token still can't be used twice.

## 3. Login with no transaction (5 → 2 statements)

**Before:** `SELECT user → BEGIN → SELECT previous session → INSERT … ON CONFLICT → COMMIT`.

**Fix:** key the Redis session cache by `userId` instead of `sessionId`. Each user has exactly one
session, so a new login simply overwrites the old cache entry. The "previous session" read was the
only reason a transaction was needed, so it goes. Login is now `SELECT user` plus one atomic upsert.

**Why it matters:** fewer round trips, and no connection is held across statements. Combined with
moving bcrypt (~100 ms of CPU) out of the transaction, a burst of logins can no longer use up the
10-connection pool and stall every other query.

## 4. Refresh lookup by primary key (~155×)

| Query                       | Plan                           | Buffers | Time    |
| --------------------------- | ------------------------------ | ------- | ------- |
| `sessions WHERE token = $1` | Seq Scan, 77,776 rows filtered | 1,342   | 4.65 ms |
| `sessions WHERE id = $1`    | Index Scan on `sessions_pkey`  | 4       | 0.03 ms |

**Fix:** `getSessionByRefreshToken(sessionId, token)` looks the session up by the id already
inside the refresh JWT, then compares SHA-256 hashes in constant time.

**Why:** a scan reads every row (O(n)), so its cost grows with the table; an index lookup reads a
handful of pages (O(log n)). Indexing the token column would also work, but it adds a second index
to every session write, while the primary-key route needs no new index at all.

## Already efficient (baseline, verified)

`getUserByEmail`, `getSessionByUserId` and `getTaskByToken` each use a unique-index scan and run in
0.03–0.06 ms at 100k rows. The expiry cleanup uses a bitmap index scan on `expiresAt`. For these,
planning (0.1–0.45 ms) costs more than execution, so prepared statements are the next lever for
the login path.

## How it's kept honest

- `tests/integration/helpers/queryLog.ts` records the SQL each call runs. Tests assert statement
  counts and shapes: one `DELETE` / `UPDATE`, an `ON CONFLICT` upsert, a primary-key lookup, and no
  `RETURNING` in the cleanup job.
- A unit test asserts that login never opens a transaction.
