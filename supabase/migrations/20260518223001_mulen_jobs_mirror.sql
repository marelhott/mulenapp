create table if not exists public.mulen_generation_jobs (
  id text primary key,
  project_id text not null references public.mulen_projects(id) on delete cascade,
  user_id text not null references public.mulen_app_users(id) on delete cascade,
  module text not null,
  status text not null,
  progress integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output_version_ids jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.mulen_model_runs (
  id text primary key,
  job_id text not null references public.mulen_generation_jobs(id) on delete cascade,
  project_id text not null references public.mulen_projects(id) on delete cascade,
  provider text not null,
  model text not null,
  input_prompt text not null,
  input_asset_ids jsonb not null default '[]'::jsonb,
  output_asset_id text,
  status text not null,
  latency_ms integer,
  cost_estimate numeric,
  error text,
  created_at timestamptz not null
);

create index if not exists idx_mulen_generation_jobs_project_id on public.mulen_generation_jobs(project_id);
create index if not exists idx_mulen_generation_jobs_status on public.mulen_generation_jobs(status);
create index if not exists idx_mulen_model_runs_job_id on public.mulen_model_runs(job_id);
create index if not exists idx_mulen_model_runs_project_id on public.mulen_model_runs(project_id);

alter table public.mulen_generation_jobs enable row level security;
alter table public.mulen_model_runs enable row level security;

drop policy if exists "Service role manages mulen_generation_jobs" on public.mulen_generation_jobs;
create policy "Service role manages mulen_generation_jobs"
  on public.mulen_generation_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages mulen_model_runs" on public.mulen_model_runs;
create policy "Service role manages mulen_model_runs"
  on public.mulen_model_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
