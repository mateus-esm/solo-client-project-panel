---
name: DB migrations workflow
description: How to apply schema changes in this project without hanging tools.
---
`drizzle-kit push` hangs on an interactive prompt (about a unique constraint) in this repo, and `tsx`/`pg` aren't resolvable from the workspace root.

**How to apply:** For schema changes: (1) run DDL directly with `psql "$DATABASE_URL"` using idempotent statements (`ADD COLUMN IF NOT EXISTS` etc.), (2) update the drizzle schema in the db package, (3) add a numbered SQL file in the db package's migrations directory so fresh/production databases get the same change.

**Stale types after schema edits:** the workspace uses TS project references — after editing `lib/db/src/schema/*`, run `pnpm exec tsc -b` in `lib/db` (or the consuming package) or the api-server typecheck reads stale `lib/db/dist/*.d.ts` and reports phantom "no exported member" errors.
