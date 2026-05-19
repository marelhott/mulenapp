# Usage And Billing

## Principle

Hosting is not the main cost risk. Uncontrolled AI generation is.

Every billable or potentially costly operation must create a usage ledger entry.

## Required Tables

```txt
subscriptions
usage_ledger
provider_costs
```

## Usage Ledger

Each model run or export should record:

- user ID,
- project ID,
- job ID,
- module,
- operation,
- provider,
- model,
- input asset count,
- output asset count,
- requested resolution,
- estimated cost,
- actual cost if available,
- status,
- created timestamp.

## Suggested Type

```ts
export type UsageLedgerEntry = {
  id: string;
  userId: string;
  projectId?: string;
  jobId?: string;
  modelRunId?: string;
  module?: MulenModule;
  operation:
    | 'preview_generation'
    | 'final_export'
    | 'upscale'
    | 'headswap'
    | 'visual_guide_step'
    | 'infographic_export'
    | 'storage'
    | 'other';
  provider?: string;
  model?: string;
  units: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  status: 'reserved' | 'committed' | 'refunded' | 'failed';
  createdAt: string;
};
```

## Plan Controls

Plans should control:

- monthly preview generations,
- monthly final exports,
- max batch size,
- max concurrent jobs,
- max output resolution,
- access to premium modules,
- watermark rules,
- retention period,
- priority queue level.

## Example Limits

Free:

- 5 previews per week,
- small resolution,
- watermark,
- max 1 active job,
- no batch modules.

Starter:

- 50 exports per month,
- max 4 variants per job,
- 2K export,
- basic Photo Director and Variant Lab.

Pro:

- 200 exports per month,
- max 12 variants per job,
- 4K export,
- Variant Lab,
- HeadSwap,
- Multi-Angle Reframe,
- Visual Guide.

Studio:

- 500+ exports per month,
- batch workflows,
- brand presets,
- client galleries,
- higher queue priority.

## Reservation Flow

Before starting a job:

1. Estimate cost.
2. Check plan limits.
3. Reserve usage.
4. Reject or downscale if over limit.
5. Commit usage after success.
6. Refund or partially refund failed model runs.

## Cost Estimate

MVP may use simple static estimates.

Later:

- provider-specific price tables,
- model-specific price tables,
- token/image/second based costing,
- actual usage reconciliation from provider responses.

## Admin Metrics

Track:

- cost per user,
- cost per module,
- provider failure rate,
- provider latency,
- retry cost,
- storage growth,
- most expensive jobs,
- users approaching limits.
