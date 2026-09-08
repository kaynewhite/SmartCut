---
name: Startup migrations
description: How SmartCut applies DB schema changes — ALTER TABLE in index.js, not schema.sql
---

New columns are added via `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS ...` blocks inside `server/index.js` at startup, not in `server/db/schema.sql`. The schema.sql is the baseline; migrations are appended to index.js.

**Why:** Keeps schema.sql as a clean baseline while allowing live schema evolution without a migration runner.

**How to apply:** Add new `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` lines to the migrations array in `server/index.js`. To verify columns exist, run `node -e "require('./db/index.js').query(...)"` from the `server/` directory — the code_execution sandbox uses a different DB connection and may return empty results.
