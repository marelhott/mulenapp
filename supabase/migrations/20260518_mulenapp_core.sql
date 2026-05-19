-- Mulen master app - independent persistence bootstrap
-- Run in Supabase SQL editor for the Mulen project used by this app.

create extension if not exists pgcrypto;

create table if not exists public.mulen_app_users (
  id text primary key,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mulen_projects (
  id text primary key,
  user_id text not null references public.mulen_app_users(id) on delete cascade,
  title text not null,
  module text not null,
  status text not null default 'draft',
  original_asset_id text,
  active_version_id text,
  visual_canon_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mulen_project_snapshots (
  project_id text primary key references public.mulen_projects(id) on delete cascade,
  user_id text not null references public.mulen_app_users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_mulen_projects_user_id on public.mulen_projects(user_id);
create index if not exists idx_mulen_projects_updated_at on public.mulen_projects(updated_at desc);
create index if not exists idx_mulen_project_snapshots_user_id on public.mulen_project_snapshots(user_id);
create index if not exists idx_mulen_project_snapshots_updated_at on public.mulen_project_snapshots(updated_at desc);

alter table public.mulen_app_users enable row level security;
alter table public.mulen_projects enable row level security;
alter table public.mulen_project_snapshots enable row level security;

drop policy if exists "Service role manages mulen_app_users" on public.mulen_app_users;
create policy "Service role manages mulen_app_users"
  on public.mulen_app_users
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages mulen_projects" on public.mulen_projects;
create policy "Service role manages mulen_projects"
  on public.mulen_projects
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages mulen_project_snapshots" on public.mulen_project_snapshots;
create policy "Service role manages mulen_project_snapshots"
  on public.mulen_project_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
