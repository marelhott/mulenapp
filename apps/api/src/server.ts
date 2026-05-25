import { config as loadEnv } from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Asset, GenerationJob, MulenModule } from '@mulen/shared';
import { mockWorkspaceSnapshot } from '@mulen/shared';
import { processJob, processQueuedJobsOnce } from './mockEngine.js';
import { canRunPromptEnhancer, enhancePromptText } from './liveProviders.js';
import { canUseMulenPersistence, getMulenPersistencePublicStatus } from './mulenPersistence.js';
import { canUseSupabaseStorage, persistSavedImageMetadata, uploadDataUrlToSupabase } from './supabaseStorage.js';
import { readStore, resetStore, updateStore } from './store.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

type CreateJobBody = {
  projectId?: string;
  module?: MulenModule;
  instruction?: string;
  lockedText?: string;
  outputCount?: number;
  aspectRatio?: 'original' | 'square' | 'portrait' | 'landscape';
  polishMode?: 'focused' | 'balanced' | 'bold';
  sourceVersionId?: string;
  input?: Record<string, unknown>;
  [key: string]: unknown;
};

type InlineUploadBody = {
  projectId?: string;
  kind?: Asset['kind'];
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
};

type CreateExportBody = {
  projectId?: string;
  versionId?: string;
  format?: 'png' | 'jpg' | 'pdf' | 'html';
  useCase?: 'web' | 'social' | 'print' | 'archive';
  workflow?: string;
};

type EnhancePromptBody = {
  prompt?: string;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureProjectId(projectId?: string) {
  return projectId || mockWorkspaceSnapshot.project.id;
}

app.get('/health', async () => ({
  ok: true,
  service: 'mulen-api',
}));

app.get('/config', async () => ({
  ok: true,
  mode: 'mock',
  features: {
    inlineUpload: true,
    photoDirector: true,
    export: true,
    liveProviders: Boolean(
      String(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN || process.env.FAL_KEY || '').trim(),
    ),
    supabase: canUseSupabaseStorage(),
    mulenPersistence: await canUseMulenPersistence(),
    r2: Boolean(
      String(process.env.R2_ACCOUNT_ID || process.env.R2_ACCESS_KEY_ID || process.env.R2_SECRET_ACCESS_KEY || process.env.R2_BUCKET || '').trim(),
    ),
  },
  apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? null,
  publicConfig: {
    supabaseUrl: String(process.env.VITE_SUPABASE_URL || '').trim() || null,
    r2PublicModelsBaseUrl: String(process.env.R2_PUBLIC_MODELS_BASE_URL || '').trim() || null,
    r2PublicLorasBaseUrl: String(process.env.R2_PUBLIC_LORAS_BASE_URL || '').trim() || null,
  },
  persistence: getMulenPersistencePublicStatus(),
}));

app.post('/debug/reset', async () => {
  const store = await resetStore();
  return {
    ok: true,
    snapshot: store.snapshot,
  };
});

app.post('/internal/process-queued', async () => {
  await processQueuedJobsOnce();
  const store = await readStore();
  return {
    ok: true,
    jobs: store.snapshot.jobs,
  };
});

app.get('/projects/:projectId', async (request) => {
  const params = request.params as { projectId: string };
  const store = await readStore();

  if (store.snapshot.project.id !== params.projectId) {
    return {
      ...store.snapshot,
      project: {
        ...store.snapshot.project,
        id: params.projectId,
      },
    };
  }

  return store.snapshot;
});

app.get('/projects/:projectId/jobs', async (request) => {
  const params = request.params as { projectId: string };
  const store = await readStore();
  return store.snapshot.jobs.filter((job) => job.projectId === params.projectId);
});

app.get('/projects/:projectId/gallery', async (request) => {
  const params = request.params as { projectId: string };
  const store = await readStore();
  return {
    assets: store.snapshot.assets.filter((asset) => asset.projectId === params.projectId),
    versions: store.snapshot.versions.filter((version) => version.projectId === params.projectId),
    qualityEvaluations: store.snapshot.qualityEvaluations.filter((qa) => qa.projectId === params.projectId),
  };
});

app.post<{ Body: InlineUploadBody }>('/assets/inline-upload', async (request, reply) => {
  const body = request.body ?? {};
  const projectId = ensureProjectId(body.projectId);
  const kind = body.kind ?? 'original';
  const createdAt = new Date().toISOString();

  if (!body.dataUrl?.startsWith('data:')) {
    return reply.code(400).send({ error: 'Missing inline image data.' });
  }

  const assetId = createId('asset');
  let url = body.dataUrl;
  let storagePath = `mock/uploads/${body.fileName ?? `${assetId}.jpg`}`;
  let persistedToSupabase = false;

  if (canUseSupabaseStorage()) {
    try {
      const uploaded = await uploadDataUrlToSupabase({
        ownerKey: projectId,
        folder: kind === 'reference' ? 'references' : kind === 'mask' ? 'masks' : 'originals',
        fileName: body.fileName ?? `${assetId}.jpg`,
        dataUrl: body.dataUrl,
        mimeType: body.mimeType,
      });
      url = uploaded.publicUrl;
      storagePath = uploaded.storagePath;
      persistedToSupabase = true;
      if (kind === 'reference') {
        await persistSavedImageMetadata({
          ownerKey: projectId,
          fileName: body.fileName ?? `${assetId}.jpg`,
          storagePath: uploaded.storagePath,
          category: 'reference',
        });
      }
    } catch (error) {
      request.log.warn({ err: error, projectId, kind }, 'Supabase inline upload failed, falling back to embedded data URL');
    }
  }

  const asset: Asset = {
    id: assetId,
    projectId,
    userId: mockWorkspaceSnapshot.project.userId,
    kind,
    url,
    storagePath,
    mimeType: body.mimeType ?? 'image/jpeg',
    createdAt,
    metadata: {
      mockMode: !persistedToSupabase,
      inlineUpload: true,
      persistedToSupabase,
    },
  };

  const store = await updateStore((current) => {
    const snapshot = current.snapshot;
    const nextAssets = [asset, ...snapshot.assets];
    const nextVisualCanon =
      kind === 'reference'
        ? {
            ...snapshot.visualCanon,
            referenceAssetIds: Array.from(new Set([assetId, ...snapshot.visualCanon.referenceAssetIds])),
            updatedAt: createdAt,
          }
        : snapshot.visualCanon;

    const nextVersions =
      kind === 'original'
        ? [
            {
              id: 'version-original',
              projectId,
              assetId,
              label: 'Original',
              module: 'photo-director' as const,
              createdAt,
              qualityScore: 72,
            },
            ...snapshot.versions.filter((version) => version.id !== 'version-original'),
          ]
        : snapshot.versions;

    return {
      ...current,
      snapshot: {
        ...snapshot,
        assets: nextAssets,
        versions: nextVersions,
        visualCanon: nextVisualCanon,
        project: {
          ...snapshot.project,
          originalAssetId: kind === 'original' ? assetId : snapshot.project.originalAssetId,
          activeVersionId: kind === 'original' ? 'version-original' : snapshot.project.activeVersionId,
          updatedAt: createdAt,
        },
      },
    };
  });

  return reply.code(201).send({
    ok: true,
    asset,
    snapshot: store.snapshot,
  });
});

app.post('/assets/upload-url', async () => ({
  uploadUrl: 'mock://inline-upload-only',
  assetId: 'asset-pending',
  storagePath: 'mock/pending/upload.jpg',
  expiresIn: 900,
  mode: 'mock',
}));

app.post<{ Body: EnhancePromptBody }>('/prompt/enhance', async (request, reply) => {
  const prompt = String(request.body?.prompt || '');
  if (!prompt.trim()) {
    return reply.code(400).send({ error: 'Prompt is empty.' });
  }

  if (!canRunPromptEnhancer()) {
    return reply.code(503).send({ error: 'Prompt enhancer is not available.' });
  }

  try {
    const enhancedPrompt = await enhancePromptText(prompt);
    return {
      ok: true,
      prompt: enhancedPrompt,
    };
  } catch (error) {
    request.log.error({ err: error }, 'Prompt enhancer failed');
    return reply.code(502).send({
      error: error instanceof Error ? error.message : 'Prompt enhancer failed.',
    });
  }
});

app.post<{ Body: CreateJobBody }>('/jobs', async (request, reply) => {
  const body = request.body ?? {};
  const projectId = ensureProjectId(body.projectId);
  const module = body.module || 'photo-director';
  const now = new Date().toISOString();
  const job: GenerationJob = {
    id: createId('job'),
    projectId,
    module,
    status: 'queued',
    progress: 0,
    input: {
      ...(body.input ?? {}),
      instruction: body.instruction ?? body.input?.instruction ?? '',
      lockedText: body.lockedText ?? body.input?.lockedText ?? '',
      outputCount: body.outputCount ?? body.input?.outputCount ?? 1,
      aspectRatio: body.aspectRatio ?? body.input?.aspectRatio ?? 'original',
      polishMode: body.polishMode ?? body.input?.polishMode ?? 'focused',
      sourceVersionId: body.sourceVersionId ?? body.input?.sourceVersionId,
    },
    outputVersionIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await updateStore((current) => ({
    ...current,
    snapshot: {
      ...current.snapshot,
      jobs: [job, ...current.snapshot.jobs],
    },
  }));

  void processJob(job.id);

  return reply.code(201).send(job);
});

app.get('/jobs/:jobId', async (request, reply) => {
  const params = request.params as { jobId: string };
  const store = await readStore();
  const job = store.snapshot.jobs.find((item) => item.id === params.jobId);

  if (!job) {
    return reply.code(404).send({ error: 'Job not found.' });
  }

  return {
    ...job,
    runs: store.snapshot.modelRuns.filter((run) => run.jobId === job.id),
  };
});

app.delete('/jobs/:jobId', async (request, reply) => {
  const params = request.params as { jobId: string };
  await updateStore((current) => {
    const snapshot = current.snapshot;
    const job = snapshot.jobs.find((j) => j.id === params.jobId);
    if (!job) return current;
    const versionIds = new Set(job.outputVersionIds);
    const versionsToRemove = snapshot.versions.filter((v) => versionIds.has(v.id));
    const assetIdsToRemove = new Set(versionsToRemove.map((v) => v.assetId).filter(Boolean));
    const remainingVersions = snapshot.versions.filter((v) => !versionIds.has(v.id));
    const wasActive = snapshot.project.activeVersionId ? versionIds.has(snapshot.project.activeVersionId) : false;
    const newActiveVersionId = wasActive
      ? (remainingVersions.find((v) => v.module === 'photo-director')?.id ?? remainingVersions[0]?.id ?? snapshot.project.activeVersionId)
      : snapshot.project.activeVersionId;
    return {
      ...current,
      snapshot: {
        ...snapshot,
        jobs: snapshot.jobs.filter((j) => j.id !== params.jobId),
        versions: remainingVersions,
        assets: snapshot.assets.filter((a) => !assetIdsToRemove.has(a.id)),
        project: { ...snapshot.project, activeVersionId: newActiveVersionId },
      },
    };
  });
  return reply.code(204).send();
});

app.delete('/versions/:versionId', async (request, reply) => {
  const params = request.params as { versionId: string };
  await updateStore((current) => {
    const snapshot = current.snapshot;
    const version = snapshot.versions.find((v) => v.id === params.versionId);
    if (!version) return current;
    const assetId = version.assetId;
    const remainingVersions = snapshot.versions.filter((v) => v.id !== params.versionId);
    const wasActive = snapshot.project.activeVersionId === params.versionId;
    const newActiveVersionId = wasActive
      ? (remainingVersions.find((v) => v.module === 'photo-director')?.id ?? remainingVersions[0]?.id ?? snapshot.project.activeVersionId)
      : snapshot.project.activeVersionId;
    return {
      ...current,
      snapshot: {
        ...snapshot,
        versions: remainingVersions,
        assets: assetId ? snapshot.assets.filter((a) => a.id !== assetId) : snapshot.assets,
        jobs: snapshot.jobs.map((job) => ({
          ...job,
          outputVersionIds: job.outputVersionIds.filter((id) => id !== params.versionId),
        })),
        project: { ...snapshot.project, activeVersionId: newActiveVersionId },
      },
    };
  });
  return reply.code(204).send();
});

app.post<{ Body: CreateExportBody }>('/exports', async (request, reply) => {
  const body = request.body ?? {};
  const projectId = ensureProjectId(body.projectId);
  const format = body.format ?? 'png';
  const useCase = body.useCase ?? 'web';
  const createdAt = new Date().toISOString();

  const store = await updateStore((current) => {
    const snapshot = current.snapshot;
    const activeVersion =
      snapshot.versions.find((version) => version.id === body.versionId) ??
      snapshot.versions.find((version) => version.id === snapshot.project.activeVersionId) ??
      snapshot.versions[0];
    const sourceAsset = snapshot.assets.find((asset) => asset.id === activeVersion?.assetId);
    const assetId = createId('asset-export');
    const asset: Asset = {
      id: assetId,
      projectId,
      userId: snapshot.project.userId,
      kind: 'export',
      url: sourceAsset?.url ?? '',
      storagePath: `mock/exports/${assetId}.${format}`,
      mimeType:
        format === 'pdf'
          ? 'application/pdf'
          : format === 'html'
            ? 'text/html'
            : format === 'jpg'
              ? 'image/jpeg'
              : 'image/png',
      createdAt,
      metadata: {
        sourceVersionId: activeVersion?.id,
        useCase,
        format,
        workflow: body.workflow ?? activeVersion?.module ?? 'photo-director',
        mockMode: true,
      },
    };

    return {
      ...current,
      snapshot: {
        ...snapshot,
        assets: [asset, ...snapshot.assets],
      },
    };
  });

  const exportAsset = store.snapshot.assets[0];
  return reply.code(201).send({
    ok: true,
    asset: exportAsset,
    snapshot: store.snapshot,
  });
});

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

await app.listen({ port, host });
