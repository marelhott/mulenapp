import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Project, WorkspaceSnapshot } from '@mulen/shared';

const PROJECTS_TABLE = 'mulen_projects';
const SNAPSHOTS_TABLE = 'mulen_project_snapshots';
const USERS_TABLE = 'mulen_app_users';
const JOBS_TABLE = 'mulen_generation_jobs';
const MODEL_RUNS_TABLE = 'mulen_model_runs';

let cachedClient: SupabaseClient | null = null;
let availabilityCache: boolean | null = null;

function getSupabaseUrl() {
  return String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
}

function getSupabaseServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function createMulenServiceClient() {
  if (cachedClient) return cachedClient;

  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!url || !serviceRoleKey) {
    return null;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

function getFallbackAppUserId() {
  return String(process.env.MULEN_APP_USER_ID || 'local-owner').trim() || 'local-owner';
}

function getFallbackAppUserName() {
  return String(process.env.MULEN_APP_USER_NAME || 'Local Owner').trim() || 'Local Owner';
}

function withAssignedUser(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const userId = snapshot.project.userId || getFallbackAppUserId();
  return {
    ...snapshot,
    project: {
      ...snapshot.project,
      userId,
    },
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      userId,
      projectId: snapshot.project.id,
    })),
  };
}

function projectRowFromSnapshot(snapshot: WorkspaceSnapshot) {
  const project = snapshot.project;
  return {
    id: project.id,
    user_id: project.userId,
    title: project.title,
    module: project.module,
    status: project.status,
    original_asset_id: project.originalAssetId ?? null,
    active_version_id: project.activeVersionId ?? null,
    visual_canon_id: project.visualCanonId ?? null,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

function userRowFromProject(project: Project) {
  return {
    id: project.userId || getFallbackAppUserId(),
    display_name: getFallbackAppUserName(),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

export async function canUseMulenPersistence() {
  if (availabilityCache !== null) {
    return availabilityCache;
  }

  const client = createMulenServiceClient();
  if (!client) {
    availabilityCache = false;
    return availabilityCache;
  }

  try {
    const { error } = await client.from(PROJECTS_TABLE).select('id').limit(1);
    availabilityCache = !error;
    return availabilityCache;
  } catch {
    availabilityCache = false;
    return availabilityCache;
  }
}

export async function readMulenSnapshot(projectId: string) {
  if (!(await canUseMulenPersistence())) {
    return null;
  }

  const client = createMulenServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from(SNAPSHOTS_TABLE)
    .select('snapshot')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !data?.snapshot) {
    return null;
  }

  return withAssignedUser(data.snapshot as WorkspaceSnapshot);
}

export async function writeMulenSnapshot(snapshot: WorkspaceSnapshot) {
  if (!(await canUseMulenPersistence())) {
    return false;
  }

  const client = createMulenServiceClient();
  if (!client) return false;

  const nextSnapshot = withAssignedUser(snapshot);
  const projectRow = projectRowFromSnapshot(nextSnapshot);
  const userRow = userRowFromProject(nextSnapshot.project);

  const userResult = await client.from(USERS_TABLE).upsert(userRow, { onConflict: 'id' });
  if (userResult.error) {
    return false;
  }

  const projectResult = await client.from(PROJECTS_TABLE).upsert(projectRow, { onConflict: 'id' });
  if (projectResult.error) {
    return false;
  }

  const snapshotResult = await client.from(SNAPSHOTS_TABLE).upsert(
    {
      project_id: nextSnapshot.project.id,
      user_id: nextSnapshot.project.userId,
      snapshot: nextSnapshot,
      updated_at: nextSnapshot.project.updatedAt,
    },
    { onConflict: 'project_id' },
  );

  if (snapshotResult.error) {
    return false;
  }

  if (nextSnapshot.jobs.length > 0) {
    const jobsResult = await client.from(JOBS_TABLE).upsert(
      nextSnapshot.jobs.map((job) => ({
        id: job.id,
        project_id: nextSnapshot.project.id,
        user_id: nextSnapshot.project.userId,
        module: job.module,
        status: job.status,
        progress: job.progress,
        input: job.input,
        output_version_ids: job.outputVersionIds,
        error: job.error ?? null,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      })),
      { onConflict: 'id' },
    );

    if (jobsResult.error) {
      return false;
    }
  }

  const validJobIds = new Set(nextSnapshot.jobs.map((job) => job.id));
  const modelRunsToMirror = nextSnapshot.modelRuns.filter((run) => validJobIds.has(run.jobId));

  if (modelRunsToMirror.length === 0) {
    return true;
  }

  const modelRunsResult = await client.from(MODEL_RUNS_TABLE).upsert(
    modelRunsToMirror.map((run) => ({
      id: run.id,
      job_id: run.jobId,
      project_id: nextSnapshot.project.id,
      provider: run.provider,
      model: run.model,
      input_prompt: run.inputPrompt,
      input_asset_ids: run.inputAssetIds,
      output_asset_id: run.outputAssetId ?? null,
      status: run.status,
      latency_ms: run.latencyMs ?? null,
      cost_estimate: run.costEstimate ?? null,
      error: run.error ?? null,
      created_at: run.createdAt,
    })),
    { onConflict: 'id' },
  );

  return !modelRunsResult.error;
}

export function getMulenPersistencePublicStatus() {
  return {
    configured: Boolean(createMulenServiceClient()),
    available: availabilityCache,
    tables: {
      users: USERS_TABLE,
      projects: PROJECTS_TABLE,
      snapshots: SNAPSHOTS_TABLE,
      jobs: JOBS_TABLE,
      modelRuns: MODEL_RUNS_TABLE,
    },
  };
}
