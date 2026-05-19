# Supabase Setup

## Goal

Mulen should no longer depend on the legacy Nano `users`, `saved_images`, or `generated_images` model for its own project memory.

The current step introduces an independent Mulen persistence layer with new `mulen_*` tables:

- `mulen_app_users`
- `mulen_projects`
- `mulen_project_snapshots`

This is the first practical separation layer for the new app. It keeps `Main` durable without waiting for the full normalized schema rollout.

## Migration File

Run this SQL in the Supabase SQL editor used by Mulen:

[`supabase/migrations/20260518_mulenapp_core.sql`](/Volumes/CODEX_DISK/apps/Mulen master app/supabase/migrations/20260518_mulenapp_core.sql)

## Environment

API needs:

```env
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
MULEN_APP_USER_ID=local-owner
MULEN_APP_USER_NAME=Local Owner
```

`MULEN_APP_USER_ID` is a temporary app-level owner identifier for the unauthenticated/dev flow. It is intentionally separate from the old Nano `users` table.

## Current Behavior

If the `mulen_*` tables exist:

- API reads snapshots from Supabase first
- API writes updated project snapshots back to Supabase
- local file store remains as a fallback cache

If the tables do not exist yet:

- app continues to work
- API falls back to the local file-backed store
- `/config` reports whether Mulen persistence is available

## Why Snapshot Persistence First

The target model is still the normalized project graph:

- projects
- assets
- versions
- edit steps
- locked areas
- visual canon
- jobs
- model runs
- quality evaluations

But for `Main`, the fastest safe separation from Nano is a dedicated Mulen snapshot table plus its own project row. That gives us:

- isolated project memory
- clean separation from Nano user tables
- a stable migration path to normalized writes later

## Next Step After This

Once the `mulen_*` tables are live, the next backend step is:

1. write `Main` project memory to both snapshot and normalized tables
2. move job claiming/status from local store to Supabase-backed job tables
3. host API and worker outside localhost
