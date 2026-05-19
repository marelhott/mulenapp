# Infrastructure Architecture

## Decision

Mulen should not be built as a small Vercel-only application with heavy API routes.

The product is a job-heavy AI production system. The web UI is light compared with image generation, storage, retry, provider routing, billing limits, and export generation.

## Target Stack

```txt
Frontend:
  Vercel

Database/Auth:
  Supabase Auth + Supabase Postgres

Image/File Storage:
  Cloudflare R2

Backend API:
  Node.js + TypeScript + Fastify

Worker:
  Node.js + TypeScript background worker

Queue MVP:
  Supabase generation_jobs / generation_tasks tables

Queue Later:
  Redis + BullMQ, Upstash, QStash, or Cloudflare Queues

Payments:
  Stripe

Observability:
  Sentry + structured job/model-run logs
```

## Responsibility Split

### Vercel Web

Owns:

- app UI,
- dashboard,
- project workspace,
- gallery views,
- pricing page,
- Stripe checkout entry,
- light API calls to the backend.

Does not own:

- long-running generation,
- direct provider calls,
- big image upload proxying,
- batch orchestration.

### Fastify API

Owns:

- project CRUD,
- auth verification,
- R2 signed upload URLs,
- R2 signed download URLs,
- generation job creation,
- usage limit checks,
- job status reads,
- Stripe webhooks,
- admin/debug endpoints.

### Worker

Owns:

- claiming queued jobs,
- decomposing jobs into model runs,
- calling AI providers,
- retries and fallback routing,
- writing outputs to R2,
- writing assets/versions/model runs to Supabase,
- quality evaluation,
- thumbnail/export generation,
- progress updates.

### Supabase

Owns:

- users/auth,
- Mulen app users/projects/snapshots,
- project memory,
- assets metadata,
- version tree,
- edit steps,
- locked areas,
- visual canon,
- generation jobs,
- model runs,
- quality evaluations,
- subscriptions,
- usage ledger.

Short-term implementation note:

- `Main` now uses a dedicated Mulen persistence layer through `mulen_app_users`, `mulen_projects`, and `mulen_project_snapshots`.
- This intentionally separates the new app from the legacy Nano `users` model before the full normalized Mulen schema is finished.

### Cloudflare R2

Owns:

- originals,
- masks,
- generated images,
- thumbnails,
- exports,
- ZIP/PDF outputs.

R2 should receive browser uploads directly through signed URLs. Large files should not be routed through Vercel functions or the API server unless there is no practical alternative.

## Storage Buckets

Recommended buckets:

```txt
mulen-originals-private
mulen-generated-private
mulen-thumbnails-public
mulen-exports-private
```

For MVP, these may be represented by one bucket plus typed prefixes:

```txt
users/{userId}/projects/{projectId}/originals/
users/{userId}/projects/{projectId}/generated/
users/{userId}/projects/{projectId}/thumbnails/
users/{userId}/projects/{projectId}/exports/
users/{userId}/projects/{projectId}/masks/
```

## Upload Flow

```txt
Browser
  -> API: request signed upload URL
  -> API: validate user/project/plan
  -> API: create pending asset metadata
  -> API: return signed R2 URL
  -> Browser: upload file directly to R2
  -> Browser/API: confirm upload
  -> API: finalize asset metadata
```

## Generation Flow

```txt
Browser
  -> API: create generation job
  -> API: check subscription and usage limits
  -> API: insert generation_job
  -> Worker: claim queued job
  -> Worker: create generation_tasks/model_runs
  -> Worker: call providers
  -> Worker: write outputs to R2
  -> Worker: write assets and versions
  -> Worker: update usage_ledger
  -> Browser: poll or subscribe to job progress
```

## Scaling View

1000 paying users is not primarily a frontend scaling problem.

The main constraints are:

- monthly generated output count,
- expensive model usage,
- provider rate limits,
- retry cost,
- image storage growth,
- concurrent batch jobs.

Architecture must protect margins with:

- per-plan limits,
- max concurrent jobs,
- max batch size,
- max resolution,
- provider budget rules,
- usage ledger,
- cost estimates per model run.
