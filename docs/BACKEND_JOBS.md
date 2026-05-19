# Backend Jobs

## Rule

All AI generation must be asynchronous.

The web app creates jobs. Workers execute jobs. The UI observes progress.

## MVP Queue

Use Supabase tables as the first queue. This keeps the first implementation simple and inspectable.

Current implementation note:

- `Main` project memory now has a dedicated Mulen snapshot persistence path in Supabase.
- Job execution itself is still processed by the API + worker runtime and the local fallback store.
- The next queue milestone is moving job state from file-backed storage into dedicated Supabase `mulen_generation_jobs` style tables.

Tables:

- `generation_jobs`
- `generation_tasks`
- `model_runs`

The worker polls for queued jobs, claims one, processes it, and updates status.

## Job States

```ts
type GenerationJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'partial'
  | 'cancelled';
```

## Task States

```ts
type GenerationTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';
```

## Claiming Jobs

MVP approach:

1. Worker asks for the oldest `queued` job.
2. Worker updates it to `running` with `claimed_by` and `claimed_at`.
3. Worker processes model runs.
4. Worker updates progress after every model run.
5. Worker marks the job `succeeded`, `partial`, or `failed`.

Later this should become an atomic Postgres function, Redis/BullMQ queue, or Cloudflare Queue.

## Worker Loop

```txt
start worker
  -> poll queued jobs
  -> claim job
  -> validate project/user/limits
  -> expand job into tasks/model runs
  -> execute tasks with concurrency limit
  -> retry transient provider errors
  -> save outputs to R2
  -> save asset/version/model run metadata
  -> write usage ledger entries
  -> mark final status
  -> continue polling
```

## Retry Policy

Retry only transient failures:

- provider overload,
- rate limit with retry-after,
- network timeout,
- temporary upstream 5xx.

Do not retry:

- invalid user input,
- policy/safety refusal,
- missing asset,
- usage limit failure,
- invalid provider credentials.

## Partial Success

Batch jobs may finish as `partial`.

Example:

- Variant Lab asks for 8 outputs.
- 6 succeed.
- 2 fail after retries.
- Job status becomes `partial`.
- The 6 successful versions remain usable.

## Concurrency Controls

Per-user limits:

- max active jobs,
- max queued jobs,
- max model runs per job,
- max monthly outputs,
- max monthly estimated spend.

Global limits:

- max worker concurrency,
- provider-specific concurrency,
- provider-specific daily cap,
- high-cost model cap.

## API Endpoints

Initial Fastify routes:

```txt
GET  /health
POST /projects
GET  /projects/:projectId
POST /assets/upload-url
POST /assets/confirm-upload
POST /jobs
GET  /jobs/:jobId
GET  /projects/:projectId/jobs
GET  /projects/:projectId/gallery
POST /stripe/webhook
```

## Job Input Shape

```ts
type GenerationJobInput = {
  module: MulenModule;
  projectId: string;
  sourceVersionId?: string;
  instruction?: string;
  lockedAreaIds?: string[];
  variantCount?: number;
  intensity?: 'subtle' | 'medium' | 'bold';
  targetUse?: string;
  qualityMode?: 'fast' | 'balanced' | 'high';
  metadata?: Record<string, unknown>;
};
```

## First Mock Worker

Before provider keys are wired:

- claim jobs from a mock local store,
- create deterministic mock model runs,
- generate placeholder output records,
- update progress,
- save version metadata.

This validates the app architecture without spending AI credits.
