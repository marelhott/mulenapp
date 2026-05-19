import type {
  Asset,
  EditStep,
  GenerationJob,
  ImageVersion,
  LockedArea,
  ModelRun,
  PreservationLevel,
  QualityEvaluation,
  WorkspaceSnapshot,
} from '@mulen/shared';
import { readStore, updateStore } from './store.js';
import { canRunLivePhotoDirector, runLivePhotoDirectorJob } from './liveProviders.js';

const MOCK_GENERATED_IMAGES = [
  'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickMockImage(snapshot: WorkspaceSnapshot, index: number) {
  return MOCK_GENERATED_IMAGES[(snapshot.versions.length + index) % MOCK_GENERATED_IMAGES.length];
}

function findActiveVersion(snapshot: WorkspaceSnapshot, preferredId?: string) {
  return (
    snapshot.versions.find((version) => version.id === preferredId) ??
    snapshot.versions.find((version) => version.id === snapshot.project.activeVersionId) ??
    snapshot.versions[0]
  );
}

function findAsset(snapshot: WorkspaceSnapshot, assetId?: string) {
  return snapshot.assets.find((asset) => asset.id === assetId);
}

function updateJob(snapshot: WorkspaceSnapshot, jobId: string, patch: Partial<GenerationJob>) {
  return snapshot.jobs.map((job) => (job.id === jobId ? { ...job, ...patch, updatedAt: new Date().toISOString() } : job));
}

function nextPhotoEditLabel(snapshot: WorkspaceSnapshot, outputCount: number, index: number) {
  const photoEdits = snapshot.versions.filter((version) => version.module === 'photo-director' && version.label !== 'Original');
  const branchLetter = String.fromCharCode(65 + photoEdits.length);
  return outputCount === 1 ? `Edit ${branchLetter}` : `Edit ${branchLetter}.${index + 1}`;
}

function parseLockedAreas(snapshot: WorkspaceSnapshot, lockedText: string | undefined, createdAt: string) {
  if (!lockedText?.trim()) return snapshot.lockedAreas;

  const parts = lockedText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) return snapshot.lockedAreas;

  const existing = new Map(snapshot.lockedAreas.map((area) => [area.label.toLowerCase(), area]));
  const next = [...snapshot.lockedAreas];

  for (const label of parts) {
    if (existing.has(label.toLowerCase())) continue;

    const strictness: PreservationLevel = label.toLowerCase().includes('logo') || label.toLowerCase().includes('text') ? 'high' : 'medium';
    const area: LockedArea = {
      id: createId('lock'),
      projectId: snapshot.project.id,
      label,
      type: label.toLowerCase().includes('logo')
        ? 'logo'
        : label.toLowerCase().includes('text')
          ? 'text'
          : label.toLowerCase().includes('product')
            ? 'product'
            : 'custom',
      strictness,
      description: `Preserve ${label} during focused edits.`,
      createdAt,
    };
    next.unshift(area);
  }

  return next;
}

function buildGeneratedAsset(snapshot: WorkspaceSnapshot, input: {
  createdAt: string;
  assetId: string;
  storageFolder: string;
  versionId: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}) {
  return {
    id: input.assetId,
    projectId: snapshot.project.id,
    userId: snapshot.project.userId,
    kind: 'generated' as const,
    url: input.imageUrl ?? pickMockImage(snapshot, 0),
    storagePath: `mock/${input.storageFolder}/${input.versionId}.jpg`,
    mimeType: 'image/jpeg',
    createdAt: input.createdAt,
    width: input.width,
    height: input.height,
    metadata: input.metadata,
  };
}

function buildVersion(snapshot: WorkspaceSnapshot, input: {
  versionId: string;
  parentVersionId?: string;
  assetId: string;
  label: string;
  prompt: string;
  module: ImageVersion['module'];
  createdAt: string;
  runId: string;
  stepId?: string;
  qualityScore: number;
  metadata?: Record<string, unknown>;
}) {
  return {
    id: input.versionId,
    projectId: snapshot.project.id,
    parentVersionId: input.parentVersionId,
    assetId: input.assetId,
    label: input.label,
    prompt: input.prompt,
    module: input.module,
    createdAt: input.createdAt,
    modelRuns: [input.runId],
    editStepId: input.stepId,
    qualityScore: input.qualityScore,
    metadata: input.metadata,
  };
}

function buildRun(jobId: string, input: {
  runId: string;
  provider: string;
  model: string;
  prompt: string;
  inputAssetIds: string[];
  outputAssetId: string;
  createdAt: string;
  latencyMs: number;
  costEstimate: number;
}) {
  return {
    id: input.runId,
    jobId,
    provider: input.provider,
    model: input.model,
    inputPrompt: input.prompt,
    inputAssetIds: input.inputAssetIds,
    outputAssetId: input.outputAssetId,
    status: 'succeeded' as const,
    latencyMs: input.latencyMs,
    costEstimate: input.costEstimate,
    createdAt: input.createdAt,
  };
}

function buildQa(snapshot: WorkspaceSnapshot, input: {
  qaId: string;
  versionId: string;
  createdAt: string;
  labels: string[];
  summary: string;
  identityPreservation?: QualityEvaluation['identityPreservation'];
  objectPreservation?: QualityEvaluation['objectPreservation'];
  styleConsistency?: QualityEvaluation['styleConsistency'];
  commercialUsefulness?: QualityEvaluation['commercialUsefulness'];
  artifactRisk?: QualityEvaluation['artifactRisk'];
}) {
  return {
    id: input.qaId,
    versionId: input.versionId,
    projectId: snapshot.project.id,
    identityPreservation: input.identityPreservation,
    objectPreservation: input.objectPreservation,
    styleConsistency: input.styleConsistency,
    commercialUsefulness: input.commercialUsefulness,
    artifactRisk: input.artifactRisk,
    labels: input.labels,
    summary: input.summary,
    createdAt: input.createdAt,
  };
}

function buildStep(snapshot: WorkspaceSnapshot, input: {
  stepId: string;
  fromVersionId?: string;
  toVersionIds: string[];
  userInstruction: string;
  agentSummary: string;
  createdAt: string;
  module: EditStep['module'];
  lockedAreaIds?: string[];
}) {
  return {
    id: input.stepId,
    projectId: snapshot.project.id,
    fromVersionId: input.fromVersionId,
    toVersionIds: input.toVersionIds,
    userInstruction: input.userInstruction,
    agentSummary: input.agentSummary,
    lockedAreaIds: input.lockedAreaIds ?? snapshot.lockedAreas.map((area) => area.id),
    visualCanonId: snapshot.visualCanon.id,
    createdAt: input.createdAt,
    module: input.module,
  };
}

function finalizeJobSnapshot(
  snapshot: WorkspaceSnapshot,
  jobId: string,
  createdAt: string,
  payload: {
    assets?: Asset[];
    versions?: ImageVersion[];
    steps?: EditStep[];
    runs?: ModelRun[];
    qaList?: QualityEvaluation[];
    outputVersionIds: string[];
    lockedAreas?: LockedArea[];
  },
) {
  return {
    ...snapshot,
    assets: [...(payload.assets ?? []), ...snapshot.assets],
    versions: [...(payload.versions ?? []), ...snapshot.versions],
    editSteps: [...(payload.steps ?? []), ...snapshot.editSteps],
    modelRuns: [...(payload.runs ?? []), ...snapshot.modelRuns],
    qualityEvaluations: [...(payload.qaList ?? []), ...snapshot.qualityEvaluations],
    lockedAreas: payload.lockedAreas ?? snapshot.lockedAreas,
    jobs: updateJob(snapshot, jobId, {
      status: 'succeeded',
      progress: 100,
      outputVersionIds: payload.outputVersionIds,
      error: undefined,
    }),
    project: {
      ...snapshot.project,
      activeVersionId: payload.outputVersionIds[0] ?? snapshot.project.activeVersionId,
      updatedAt: createdAt,
    },
  };
}

function processPhotoDirector(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const outputCount = Math.max(1, Math.min(Number(input.outputCount ?? 1), 5));
  const sourceVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const sourceAsset = findAsset(snapshot, sourceVersion?.assetId);
  const createdAt = new Date().toISOString();
  const lockedAreas = parseLockedAreas(snapshot, String(input.lockedText || ''), createdAt);
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const steps: EditStep[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];
  const outputVersionIds: string[] = [];

  for (let index = 0; index < outputCount; index += 1) {
    const assetId = createId('asset-generated');
    const versionId = createId('version-generated');
    const stepId = createId('step');
    const runId = createId('run');
    const qaId = createId('qa');

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'generated',
        versionId,
        imageUrl: sourceAsset?.url ?? pickMockImage(snapshot, index),
        width: sourceAsset?.width,
        height: sourceAsset?.height,
        metadata: {
          mockMode: true,
          aspectRatio: input.aspectRatio ?? 'original',
          polishMode: input.polishMode ?? 'focused',
        },
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: sourceVersion?.id,
        assetId,
        label: nextPhotoEditLabel(snapshot, outputCount, index),
        prompt: String(input.instruction || ''),
        module: 'photo-director',
        createdAt,
        runId,
        stepId,
        qualityScore: 80 + Math.max(0, 6 - index),
        metadata: {
          mockMode: true,
          aspectRatio: input.aspectRatio ?? 'original',
          polishMode: input.polishMode ?? 'focused',
        },
      }),
    );

    steps.push(
      buildStep(snapshot, {
        stepId,
        fromVersionId: sourceVersion?.id,
        toVersionIds: [versionId],
        userInstruction: String(input.instruction || ''),
        agentSummary: `Mock backend preserved ${String(input.lockedText || 'the important parts')} and created a new project version.`,
        createdAt,
        module: 'photo-director',
        lockedAreaIds: lockedAreas.map((area) => area.id),
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: input.polishMode === 'focused' ? 'precise-edit-mock' : 'balanced-edit-mock',
        prompt: String(input.instruction || ''),
        inputAssetIds: sourceVersion ? [sourceVersion.assetId] : [],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1200 + index * 120,
        costEstimate: 0.01,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId,
        versionId,
        createdAt,
        identityPreservation: 'high',
        objectPreservation: 'high',
        styleConsistency: input.polishMode === 'bold' ? 'medium' : 'high',
        commercialUsefulness: 'high',
        artifactRisk: 'low',
        labels: [input.polishMode === 'focused' ? 'Jen doladit' : 'Photo Director', index === 0 ? 'Mock preview' : 'Nova vetev'],
        summary: 'Main workflow is active in backend execution mode.',
      }),
    );

    outputVersionIds.push(versionId);
  }

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    steps,
    runs,
    qaList,
    outputVersionIds,
    lockedAreas,
  });
}

function processUpscale(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const createdAt = new Date().toISOString();
  const activeVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const assetId = createId('asset-upscale');
  const versionId = createId('version-upscale');
  const runId = createId('run-upscale');
  const qaId = createId('qa-upscale');

  const asset = buildGeneratedAsset(snapshot, {
    createdAt,
    assetId,
    storageFolder: 'upscale',
    versionId,
    imageUrl: pickMockImage(snapshot, 0),
    metadata: {
      workflow: 'ai-upscaler',
      workflowLabel: 'AI Upscaler',
      scale: input.scale ?? '2k',
      focus: input.focus ?? 'full',
    },
  });

  const version = buildVersion(snapshot, {
    versionId,
    parentVersionId: activeVersion?.id,
    assetId,
    label: `Upscale ${String(input.scale ?? '2k').toUpperCase()}`,
    prompt: `Upscale ${String(input.scale ?? '2k')} with focus ${String(input.focus ?? 'full')}`,
    module: 'photo-director',
    createdAt,
    runId,
    qualityScore: 91,
    metadata: {
      workflow: 'ai-upscaler',
      workflowLabel: 'AI Upscaler',
      scale: input.scale ?? '2k',
      focus: input.focus ?? 'full',
    },
  });

  const run = buildRun(job.id, {
    runId,
    provider: 'internal-router',
    model: 'upscale-mock',
    prompt: version.prompt ?? '',
    inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
    outputAssetId: assetId,
    createdAt,
    latencyMs: 1800,
    costEstimate: 0.02,
  });

  const qa = buildQa(snapshot, {
    qaId,
    versionId,
    createdAt,
    identityPreservation: 'high',
    objectPreservation: 'high',
    styleConsistency: 'high',
    commercialUsefulness: 'high',
    artifactRisk: 'low',
    labels: ['AI Upscaler', String(input.scale ?? '2k').toUpperCase()],
    summary: 'Upscaled branch preserved the current direction.',
  });

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets: [asset],
    versions: [version],
    runs: [run],
    qaList: [qa],
    outputVersionIds: [versionId],
  });
}

function processStyleTransfer(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const activeVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const createdAt = new Date().toISOString();
  const outputVersionIds: string[] = [];
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];

  for (let index = 0; index < 2; index += 1) {
    const assetId = createId('asset-style-transfer');
    const versionId = createId('version-style-transfer');
    const runId = createId('run-style-transfer');
    const qaId = createId('qa-style-transfer');

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'style-transfer',
        versionId,
        imageUrl: pickMockImage(snapshot, index),
        metadata: {
          workflow: 'style-transfer',
          workflowLabel: 'Style Transfer',
          preserveComposition: Boolean(input.preserveComposition),
        },
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: activeVersion?.id,
        assetId,
        label: `Style Transfer ${index + 1}`,
        prompt: String(input.prompt || ''),
        module: 'photo-director',
        createdAt,
        runId,
        qualityScore: 85 + index,
        metadata: {
          workflow: 'style-transfer',
          workflowLabel: 'Style Transfer',
          preserveComposition: Boolean(input.preserveComposition),
        },
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: Boolean(input.preserveComposition) ? 'style-transfer-preserve' : 'style-transfer-free',
        prompt: String(input.prompt || ''),
        inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1700 + index * 120,
        costEstimate: 0.03,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId,
        versionId,
        createdAt,
        identityPreservation: 'high',
        objectPreservation: Boolean(input.preserveComposition) ? 'high' : 'medium',
        styleConsistency: 'high',
        commercialUsefulness: 'high',
        artifactRisk: 'low',
        labels: ['Style Transfer', Boolean(input.preserveComposition) ? 'Zachovana kompozice' : 'Volnejsi styl'],
        summary: 'Transferred styling while keeping the branch linked to the current active image history.',
      }),
    );

    outputVersionIds.push(versionId);
  }

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    runs,
    qaList,
    outputVersionIds,
  });
}

function processVariantLab(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const activeVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const createdAt = new Date().toISOString();
  const labels = ['Nejvernejsi', 'Nejlepsi pro reklamu', 'Nejlepsi pro web', 'Nejlepsi pro socialni site', 'Nejodvaznejsi'];
  const outputVersionIds: string[] = [];
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];
  const count = Math.max(1, Math.min(Number(input.count ?? 4), 20));

  for (let index = 0; index < count; index += 1) {
    const assetId = createId('asset-variantlab');
    const versionId = createId('version-variantlab');
    const runId = createId('run-variantlab');
    const qaId = createId('qa-variantlab');
    const label = labels[index % labels.length];

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'generated',
        versionId,
        imageUrl: pickMockImage(snapshot, index),
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: activeVersion?.id,
        assetId,
        label: `Variant ${index + 1}`,
        prompt: `${String(input.instruction || '')} [${String(input.intensity || 'stredne')}]`,
        module: 'variant-lab',
        createdAt,
        runId,
        qualityScore: 80 + (index % 10),
        metadata: input.workflow ? { workflow: input.workflow } : undefined,
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: `creative-variation-${String(input.intensity || 'stredne')}`,
        prompt: String(input.instruction || ''),
        inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1600 + index * 120,
        costEstimate: 0.03,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId,
        versionId,
        createdAt,
        identityPreservation: 'high',
        objectPreservation: 'high',
        styleConsistency: 'medium',
        commercialUsefulness: 'high',
        artifactRisk: input.intensity === 'odvazne' ? 'medium' : 'low',
        labels: [label],
        summary: `Variant ${index + 1} keeps the main object and explores a ${String(input.intensity || 'stredne')} direction.`,
      }),
    );

    outputVersionIds.push(versionId);
  }

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    runs,
    qaList,
    outputVersionIds,
  });
}

function processModelInfluence(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const activeVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const createdAt = new Date().toISOString();
  const outputVersionIds: string[] = [];
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];

  ['A', 'B'].forEach((variant, index) => {
    const assetId = createId('asset-model-influence');
    const versionId = createId('version-model-influence');
    const runId = createId('run-model-influence');
    const qaId = createId('qa-model-influence');

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'model-influence',
        versionId,
        imageUrl: pickMockImage(snapshot, index),
        metadata: {
          workflow: 'model-influence',
          workflowLabel: 'Model Influence',
          strength: input.strength ?? 'medium',
        },
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: activeVersion?.id,
        assetId,
        label: `Model Influence ${variant}`,
        prompt: String(input.prompt || ''),
        module: 'variant-lab',
        createdAt,
        runId,
        qualityScore: 83 + index,
        metadata: {
          workflow: 'model-influence',
          workflowLabel: 'Model Influence',
          strength: input.strength ?? 'medium',
        },
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: `model-influence-${String(input.strength || 'medium')}`,
        prompt: String(input.prompt || ''),
        inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1450 + index * 120,
        costEstimate: 0.025,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId,
        versionId,
        createdAt,
        identityPreservation: 'high',
        objectPreservation: 'medium',
        styleConsistency: 'high',
        commercialUsefulness: 'high',
        artifactRisk: input.strength === 'high' ? 'medium' : 'low',
        labels: ['Model Influence', input.strength === 'high' ? 'Silny posun' : 'Kontrolovany posun'],
        summary: 'Influence branch shifted the overall rendering feel while preserving the main image anchor.',
      }),
    );

    outputVersionIds.push(versionId);
  });

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    runs,
    qaList,
    outputVersionIds,
  });
}

function processMultiAngle(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const activeVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const createdAt = new Date().toISOString();
  const shotLabels = [
    'Front hero',
    '45 left',
    '45 right',
    'Top down',
    'Detail crop',
    'Material detail',
    'Lifestyle context',
    'Banner negative space',
    'Social vertical',
    'Wide context',
    'Close-up',
    'Hero ad shot',
    'Room angle',
    'Mood shot',
    'Product corner',
  ];
  const qaLabels = ['Hero', 'Detail', 'Context', 'Social', 'Banner', 'Close-up', 'Lifestyle', 'Wide'];
  const count = Math.max(1, Math.min(Number(input.shotCount ?? 8), 15));
  const outputVersionIds: string[] = [];
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];
  const steps: EditStep[] = [];

  for (let index = 0; index < count; index += 1) {
    const assetId = createId('asset-multi-angle');
    const versionId = createId('version-multi-angle');
    const runId = createId('run-multi-angle');
    const qualityId = createId('qa-multi-angle');
    const stepId = createId('step-multi-angle');
    const cameraLabel = shotLabels[index] ?? `Shot ${index + 1}`;
    const qaLabel = qaLabels[index % qaLabels.length];

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'generated',
        versionId,
        imageUrl: pickMockImage(snapshot, index),
        metadata: {
          cameraPurpose: qaLabel,
          cameraPlan: cameraLabel,
          setType: input.setType ?? 'produktova',
        },
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: activeVersion?.id,
        assetId,
        label: cameraLabel,
        prompt: `Create a ${String(input.setType ?? 'produktova')} camera-set shot that preserves the object, materials and brand direction.`,
        module: 'multi-angle-reframe',
        createdAt,
        runId,
        stepId,
        qualityScore: 82 + (index % 7),
        metadata: {
          cameraPurpose: qaLabel,
          precision: input.precision ?? 'bezpecna',
        },
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: `multi-angle-${String(input.precision ?? 'bezpecna')}`,
        prompt: `Generate ${cameraLabel} for the same visual canon.`,
        inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1800 + index * 150,
        costEstimate: 0.035,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId: qualityId,
        versionId,
        createdAt,
        identityPreservation: 'high',
        objectPreservation: 'high',
        styleConsistency: 'high',
        commercialUsefulness: 'high',
        artifactRisk: input.precision === 'kreativni' ? 'medium' : 'low',
        labels: [qaLabel],
        summary: `${cameraLabel} keeps the same object and extends the camera plan into a new angle.`,
      }),
    );

    steps.push(
      buildStep(snapshot, {
        stepId,
        fromVersionId: activeVersion?.id,
        toVersionIds: [versionId],
        userInstruction: `Vytvor camera set: ${String(input.setType ?? 'produktova')}`,
        agentSummary: `Planned camera set shot ${cameraLabel} while preserving the active visual canon.`,
        createdAt,
        module: 'multi-angle-reframe',
      }),
    );

    outputVersionIds.push(versionId);
  }

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    steps,
    runs,
    qaList,
    outputVersionIds,
  });
}

function processHeadswap(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const createdAt = new Date().toISOString();

  if (input.workflow === 'refine') {
    const baseVersion = findActiveVersion(snapshot, String(input.baseVersionId || ''));
    const assetId = createId('asset-headswap-refine');
    const versionId = createId('version-headswap-refine');
    const runId = createId('run-headswap-refine');
    const qaId = createId('qa-headswap-refine');
    const stepId = createId('step-headswap-refine');
    const asset = buildGeneratedAsset(snapshot, {
      createdAt,
      assetId,
      storageFolder: 'generated',
      versionId,
      imageUrl: pickMockImage(snapshot, 0),
    });
    const version = buildVersion(snapshot, {
      versionId,
      parentVersionId: baseVersion?.id,
      assetId,
      label: `${baseVersion?.label ?? 'HeadSwap'} refine`,
      prompt: String(input.note || ''),
      module: 'headswap',
      createdAt,
      runId,
      stepId,
      qualityScore: 86,
    });
    const step = buildStep(snapshot, {
      stepId,
      fromVersionId: baseVersion?.id,
      toVersionIds: [versionId],
      userInstruction: String(input.note || ''),
      agentSummary: 'Refined a selected headswap branch with a targeted correction request.',
      createdAt,
      module: 'headswap',
    });
    const run = buildRun(job.id, {
      runId,
      provider: 'internal-router',
      model: 'headswap-refine',
      prompt: String(input.note || ''),
      inputAssetIds: baseVersion ? [baseVersion.assetId] : [],
      outputAssetId: assetId,
      createdAt,
      latencyMs: 1600,
      costEstimate: 0.03,
    });
    const qa = buildQa(snapshot, {
      qaId,
      versionId,
      createdAt,
      identityPreservation: 'high',
      objectPreservation: 'high',
      styleConsistency: 'medium',
      commercialUsefulness: 'high',
      artifactRisk: 'low',
      labels: ['dolazena varianta'],
      summary: 'A selected headswap output was refined with a targeted note.',
    });

    return finalizeJobSnapshot(snapshot, job.id, createdAt, {
      assets: [asset],
      versions: [version],
      steps: [step],
      runs: [run],
      qaList: [qa],
      outputVersionIds: [versionId],
    });
  }

  const sourceAssetId = typeof input.sourceAssetId === 'string' ? input.sourceAssetId : undefined;
  const targetAssetId =
    typeof input.targetAssetId === 'string' ? input.targetAssetId : snapshot.project.originalAssetId;
  const labels = ['nejlepsi identita', 'nejlepsi blending', 'nejprirozenejsi plet', 'nejlepsi svetlo'];
  const outputVersionIds: string[] = [];
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];
  const steps: EditStep[] = [];

  for (let index = 0; index < 4; index += 1) {
    const assetId = createId('asset-headswap');
    const versionId = createId('version-headswap');
    const runId = createId('run-headswap');
    const qaId = createId('qa-headswap');
    const stepId = createId('step-headswap');
    const label = labels[index];

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'generated',
        versionId,
        imageUrl: pickMockImage(snapshot, index),
        metadata: {
          hairMode: input.hairMode ?? 'auto',
          headswapLabel: label,
        },
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: snapshot.project.activeVersionId,
        assetId,
        label: `HeadSwap ${index + 1}`,
        prompt: `Compare headswap result with ${label} priority.`,
        module: 'headswap',
        createdAt,
        runId,
        stepId,
        qualityScore: 79 + index,
        metadata: {
          headswapLabel: label,
        },
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: `headswap-model-${index + 1}`,
        prompt: `Blend source identity into target with ${label} priority.`,
        inputAssetIds: [sourceAssetId, targetAssetId].filter(Boolean) as string[],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1700 + index * 150,
        costEstimate: 0.05,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId,
        versionId,
        createdAt,
        identityPreservation: index === 0 ? 'high' : 'medium',
        objectPreservation: 'high',
        styleConsistency: 'medium',
        commercialUsefulness: 'high',
        artifactRisk: 'low',
        labels: [label],
        summary: `This headswap output prioritizes ${label}.`,
      }),
    );

    steps.push(
      buildStep(snapshot, {
        stepId,
        fromVersionId: snapshot.project.activeVersionId,
        toVersionIds: [versionId],
        userInstruction: 'Porovnej vice headswap modelu.',
        agentSummary: `Created a comparison branch for ${label}.`,
        createdAt,
        module: 'headswap',
      }),
    );

    outputVersionIds.push(versionId);
  }

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    steps,
    runs,
    qaList,
    outputVersionIds,
  });
}

function processVisualGuide(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const activeVersion = findActiveVersion(snapshot, String(input.sourceVersionId || ''));
  const createdAt = new Date().toISOString();
  const count = Math.max(1, Math.min(Number(input.stepCount ?? 5), 10));
  const outputVersionIds: string[] = [];
  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];
  const steps: EditStep[] = [];

  for (let index = 0; index < count; index += 1) {
    const assetId = createId('asset-guide');
    const versionId = createId('version-guide');
    const runId = createId('run-guide');
    const qaId = createId('qa-guide');
    const stepId = createId('step-guide');

    assets.push(
      buildGeneratedAsset(snapshot, {
        createdAt,
        assetId,
        storageFolder: 'generated',
        versionId,
        imageUrl: pickMockImage(snapshot, index),
        metadata: {
          stepNumber: index + 1,
          caption: `Krok ${index + 1}`,
        },
      }),
    );

    versions.push(
      buildVersion(snapshot, {
        versionId,
        parentVersionId: activeVersion?.id,
        assetId,
        label: `Krok ${index + 1}`,
        prompt: String(input.prompt || ''),
        module: 'visual-guide',
        createdAt,
        runId,
        stepId,
        qualityScore: 83,
      }),
    );

    runs.push(
      buildRun(job.id, {
        runId,
        provider: 'internal-router',
        model: 'visual-guide-step',
        prompt: `Generate step ${index + 1} for: ${String(input.prompt || '')}`,
        inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
        outputAssetId: assetId,
        createdAt,
        latencyMs: 1400 + index * 100,
        costEstimate: 0.025,
      }),
    );

    qaList.push(
      buildQa(snapshot, {
        qaId,
        versionId,
        createdAt,
        styleConsistency: 'high',
        commercialUsefulness: 'high',
        artifactRisk: 'low',
        labels: [`krok ${index + 1}`],
        summary: `Step ${index + 1} remains consistent with the guide series.`,
      }),
    );

    steps.push(
      buildStep(snapshot, {
        stepId,
        fromVersionId: activeVersion?.id,
        toVersionIds: [versionId],
        userInstruction: String(input.prompt || ''),
        agentSummary: `Prepared guide step ${index + 1} with shared visual canon.`,
        createdAt,
        module: 'visual-guide',
      }),
    );

    outputVersionIds.push(versionId);
  }

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets,
    versions,
    steps,
    runs,
    qaList,
    outputVersionIds,
  });
}

function processInfographic(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const createdAt = new Date().toISOString();
  const versionId = createId('version-infographic');
  const assetId = createId('asset-infographic');
  const runId = createId('run-infographic');
  const qaId = createId('qa-infographic');
  const sections = [
    { id: createId('section'), type: 'hero' as const, title: 'Kontext', body: 'Kdy je vhodne dane tema resit a proc na nem zalezi.' },
    { id: createId('section'), type: 'comparison' as const, title: 'Srovnani', body: 'Nejdulezitejsi rozdily ve zkratce a jasne strukture.' },
    { id: createId('section'), type: 'steps' as const, title: 'Doporuceni', body: 'Jak by mel ctenar tema pouzit v praxi.' },
  ];

  const asset: Asset = {
    id: assetId,
    projectId: snapshot.project.id,
    userId: snapshot.project.userId,
    kind: 'export',
    url: 'infographic-layout',
    storagePath: `mock/exports/${versionId}.html`,
    mimeType: 'text/html',
    createdAt,
    metadata: {
      layout: {
        title: String(input.topic || 'Infographic'),
        theme: input.theme === 'dark' ? 'dark' : 'light',
        format: input.format === 'square' || input.format === 'story' || input.format === 'wide' ? input.format : 'A4',
        accentColor: '#6f6af8',
        sections,
      },
    },
  };

  const version = buildVersion(snapshot, {
    versionId,
    parentVersionId: snapshot.project.activeVersionId,
    assetId,
    label: 'Infographic layout',
    prompt: String(input.topic || ''),
    module: 'infographic-generator',
    createdAt,
    runId,
    qualityScore: 90,
    metadata: {
      infographic: true,
    },
  });

  const run = buildRun(job.id, {
    runId,
    provider: 'internal-router',
    model: 'infographic-layout',
    prompt: String(input.topic || ''),
    inputAssetIds: [],
    outputAssetId: assetId,
    createdAt,
    latencyMs: 1100,
    costEstimate: 0.02,
  });

  const qa = buildQa(snapshot, {
    qaId,
    versionId,
    createdAt,
    styleConsistency: 'high',
    commercialUsefulness: 'high',
    artifactRisk: 'low',
    labels: ['ostry text', 'layout render'],
    summary: 'The infographic was rendered as real structured content instead of AI text in pixels.',
  });

  return finalizeJobSnapshot(snapshot, job.id, createdAt, {
    assets: [asset],
    versions: [version],
    runs: [run],
    qaList: [qa],
    outputVersionIds: [versionId],
  });
}

function processJobSnapshot(snapshot: WorkspaceSnapshot, job: GenerationJob) {
  if (job.module === 'photo-director') {
    const workflow = String(job.input?.workflow || '');
    if (workflow === 'ai-upscaler') return processUpscale(snapshot, job);
    if (workflow === 'style-transfer') return processStyleTransfer(snapshot, job);
    return processPhotoDirector(snapshot, job);
  }

  if (job.module === 'variant-lab') {
    if (job.input?.workflow === 'model-influence') return processModelInfluence(snapshot, job);
    return processVariantLab(snapshot, job);
  }

  if (job.module === 'multi-angle-reframe') return processMultiAngle(snapshot, job);
  if (job.module === 'headswap') return processHeadswap(snapshot, job);
  if (job.module === 'visual-guide') return processVisualGuide(snapshot, job);
  if (job.module === 'infographic-generator') return processInfographic(snapshot, job);

  return {
    ...snapshot,
    jobs: updateJob(snapshot, job.id, {
      status: 'partial',
      progress: 100,
      error: `Unsupported module ${job.module}.`,
      outputVersionIds: [],
    }),
  };
}

export async function processJob(jobId: string) {
  await updateStore((store) => ({
    ...store,
    snapshot: {
      ...store.snapshot,
      jobs: updateJob(store.snapshot, jobId, {
        status: 'running',
        progress: 20,
      }),
    },
  }));

  await sleep(450);

  const current = await readStore();
  const job = current.snapshot.jobs.find((item) => item.id === jobId);
  if (!job) return;

  try {
    if (job.module === 'photo-director' && !job.input?.workflow && canRunLivePhotoDirector()) {
      const liveSnapshot = await runLivePhotoDirectorJob(current.snapshot, job);
      await updateStore((store) => ({
        ...store,
        snapshot: liveSnapshot,
      }));
      return;
    }
  } catch (error) {
    await updateStore((store) => ({
      ...store,
      snapshot: {
        ...store.snapshot,
        jobs: updateJob(store.snapshot, jobId, {
          status: 'running',
          progress: 55,
          error: error instanceof Error ? error.message : 'Live provider failed, falling back to mock execution.',
        }),
      },
    }));
  }

  await updateStore((store) => {
    const currentJob = store.snapshot.jobs.find((item) => item.id === jobId);
    if (!currentJob) return store;

    return {
      ...store,
      snapshot: processJobSnapshot(store.snapshot, currentJob),
    };
  });
}

export async function processPhotoDirectorJob(jobId: string) {
  await processJob(jobId);
}

export async function processQueuedJobsOnce() {
  const store = await updateStore((current) => current);
  const queuedJobs = store.snapshot.jobs.filter((job) => job.status === 'queued');

  for (const job of queuedJobs) {
    await processJob(job.id);
  }
}
