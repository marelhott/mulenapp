# Data Model

## Overview

Mulen needs project-level memory. Nano stores generated images and image-local version metadata, but Mulen requires a normalized project graph with assets, branches, jobs, runs, locked areas, visual canon, and quality evaluation.

## TypeScript Types

```ts
export type MulenModule =
  | 'photo-director'
  | 'variant-lab'
  | 'multi-angle-reframe'
  | 'headswap'
  | 'visual-guide'
  | 'infographic-generator';

export type Project = {
  id: string;
  userId: string;
  title: string;
  module: MulenModule;
  createdAt: string;
  updatedAt: string;
  originalAssetId?: string;
  activeVersionId?: string;
  visualCanonId?: string;
  status: 'draft' | 'active' | 'archived';
};

export type Asset = {
  id: string;
  projectId: string;
  userId: string;
  kind: 'original' | 'reference' | 'mask' | 'generated' | 'thumbnail' | 'export';
  url: string;
  storagePath: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type ImageVersion = {
  id: string;
  projectId: string;
  parentVersionId?: string;
  assetId: string;
  label?: string;
  prompt?: string;
  negativePrompt?: string;
  module: MulenModule;
  createdAt: string;
  modelRuns?: string[];
  editStepId?: string;
  qualityScore?: number;
  isFavorite?: boolean;
  isRejected?: boolean;
  metadata?: Record<string, unknown>;
};

export type EditStep = {
  id: string;
  projectId: string;
  fromVersionId?: string;
  toVersionIds: string[];
  userInstruction: string;
  agentSummary: string;
  lockedAreaIds: string[];
  visualCanonId?: string;
  createdAt: string;
  module: MulenModule;
};

export type LockedArea = {
  id: string;
  projectId: string;
  label: string;
  type: 'face' | 'product' | 'logo' | 'hands' | 'text' | 'room' | 'composition' | 'custom';
  maskAssetId?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  description?: string;
  strictness: 'low' | 'medium' | 'high';
  createdAt: string;
};

export type RecurringObject = {
  id: string;
  name: string;
  description: string;
  mustRemainConsistent: boolean;
};

export type VisualCanon = {
  id: string;
  projectId: string;
  styleSummary: string;
  lighting: string;
  colorPalette: string;
  environment: string;
  cameraLanguage: string;
  recurringObjects: RecurringObject[];
  doNotChange: string[];
  avoid: string[];
  referenceAssetIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type GenerationJob = {
  id: string;
  projectId: string;
  module: MulenModule;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial';
  progress: number;
  input: Record<string, unknown>;
  outputVersionIds: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type ModelRun = {
  id: string;
  jobId: string;
  provider: string;
  model: string;
  inputPrompt: string;
  inputAssetIds: string[];
  outputAssetId?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  latencyMs?: number;
  costEstimate?: number;
  error?: string;
  createdAt: string;
};

export type QualityEvaluation = {
  id: string;
  versionId: string;
  projectId: string;
  identityPreservation?: 'low' | 'medium' | 'high';
  objectPreservation?: 'low' | 'medium' | 'high';
  styleConsistency?: 'low' | 'medium' | 'high';
  commercialUsefulness?: 'low' | 'medium' | 'high';
  artifactRisk?: 'low' | 'medium' | 'high';
  labels: string[];
  summary: string;
  createdAt: string;
};
```

## Model Router Types

```ts
export type ModelTask =
  | 'precise_edit'
  | 'creative_variation'
  | 'identity_preserving'
  | 'style_transfer'
  | 'multi_angle'
  | 'headswap'
  | 'visual_guide_step'
  | 'upscale'
  | 'infographic_illustration';

export type ModelRouterInput = {
  task: ModelTask;
  module: MulenModule;
  sourceImages: Asset[];
  prompt: string;
  lockedAreas?: LockedArea[];
  visualCanon?: VisualCanon;
  count?: number;
  qualityMode?: 'fast' | 'balanced' | 'high';
};

export type ModelRouterOutput = {
  provider: string;
  model: string;
  reason: string;
  fallbackProviders: string[];
};
```

## Infographic Types

```ts
export type InfographicLayout = {
  title: string;
  subtitle?: string;
  theme: 'light' | 'dark';
  accentColor: string;
  sections: InfographicSection[];
  format: 'A4' | 'A3' | 'square' | 'story' | 'wide';
};

export type InfographicSection = {
  id: string;
  type: 'hero' | 'text' | 'cards' | 'comparison' | 'timeline' | 'funnel' | 'steps' | 'pricing' | 'metrics';
  title: string;
  body?: string;
  items?: InfographicItem[];
};

export type InfographicItem = {
  title: string;
  body?: string;
  icon?: string;
  value?: string;
};
```

## Supabase Tables

Recommended tables:

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  module text not null,
  original_asset_id uuid,
  active_version_id uuid,
  visual_canon_id uuid,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  url text not null,
  storage_path text not null,
  mime_type text not null,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.image_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_version_id uuid references public.image_versions(id) on delete set null,
  asset_id uuid not null references public.assets(id) on delete cascade,
  label text,
  prompt text,
  negative_prompt text,
  module text not null,
  model_runs text[] not null default '{}',
  edit_step_id uuid,
  quality_score numeric,
  is_favorite boolean not null default false,
  is_rejected boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.edit_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_version_id uuid references public.image_versions(id) on delete set null,
  to_version_ids uuid[] not null default '{}',
  user_instruction text not null,
  agent_summary text not null,
  locked_area_ids uuid[] not null default '{}',
  visual_canon_id uuid,
  module text not null,
  created_at timestamptz not null default now()
);

create table public.locked_areas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  type text not null,
  mask_asset_id uuid references public.assets(id) on delete set null,
  bounding_box jsonb,
  description text,
  strictness text not null default 'medium',
  created_at timestamptz not null default now()
);

create table public.visual_canons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  style_summary text not null default '',
  lighting text not null default '',
  color_palette text not null default '',
  environment text not null default '',
  camera_language text not null default '',
  recurring_objects jsonb not null default '[]'::jsonb,
  do_not_change text[] not null default '{}',
  avoid text[] not null default '{}',
  reference_asset_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  module text not null,
  status text not null default 'queued',
  progress integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output_version_ids uuid[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.model_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  provider text not null,
  model text not null,
  input_prompt text not null,
  input_asset_ids uuid[] not null default '{}',
  output_asset_id uuid references public.assets(id) on delete set null,
  status text not null default 'queued',
  latency_ms integer,
  cost_estimate numeric,
  error text,
  created_at timestamptz not null default now()
);

create table public.quality_evaluations (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.image_versions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  identity_preservation text,
  object_preservation text,
  style_consistency text,
  commercial_usefulness text,
  artifact_risk text,
  labels text[] not null default '{}',
  summary text not null default '',
  created_at timestamptz not null default now()
);
```

## Migration Strategy From Nano

Nano `generated_images` can map into Mulen as:

- `generated_images.storage_path` -> `assets.storage_path`
- `generated_images.prompt` -> `image_versions.prompt`
- `generated_images.params` -> `model_runs` plus version metadata
- `generated_images.thumbnail_path` -> thumbnail `Asset`

Nano `saved_images` can map into Mulen as:

- reference/style/asset images -> `assets` with `kind = 'reference'`

Nano `GeneratedImage.versions` should become separate rows in `image_versions` with `parent_version_id`.

## Initial Mock Mode

Before Supabase project tables are implemented, the new app can use an in-memory or localStorage-backed mock project store with the same type shapes. This lets UI and workflows be tested without provider keys or database migrations.
