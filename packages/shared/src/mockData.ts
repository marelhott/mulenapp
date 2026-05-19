import type {
  Asset,
  EditStep,
  GenerationJob,
  ImageVersion,
  LockedArea,
  ModelRun,
  Project,
  QualityEvaluation,
  VisualCanon,
  WorkspaceSnapshot,
} from './types';

const now = new Date('2026-05-15T08:00:00.000Z').toISOString();

export const mockProject: Project = {
  id: 'project-demo-001',
  userId: 'user-demo',
  title: 'Premium product shoot',
  module: 'photo-director',
  createdAt: now,
  updatedAt: now,
  originalAssetId: 'asset-original',
  activeVersionId: 'version-variant-b',
  visualCanonId: 'canon-demo',
  status: 'active',
};

export const mockAssets: Asset[] = [
  {
    id: 'asset-original',
    projectId: mockProject.id,
    userId: mockProject.userId,
    kind: 'original',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
    storagePath: 'mock/originals/product.jpg',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 800,
    createdAt: now,
  },
  {
    id: 'asset-variant-a',
    projectId: mockProject.id,
    userId: mockProject.userId,
    kind: 'generated',
    url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1200&q=80',
    storagePath: 'mock/generated/variant-a.jpg',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 800,
    createdAt: now,
  },
  {
    id: 'asset-variant-b',
    projectId: mockProject.id,
    userId: mockProject.userId,
    kind: 'generated',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80',
    storagePath: 'mock/generated/variant-b.jpg',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 800,
    createdAt: now,
  },
];

export const mockVersions: ImageVersion[] = [
  {
    id: 'version-original',
    projectId: mockProject.id,
    assetId: 'asset-original',
    label: 'Original',
    module: 'photo-director',
    createdAt: now,
    qualityScore: 72,
  },
  {
    id: 'version-variant-a',
    projectId: mockProject.id,
    parentVersionId: 'version-original',
    assetId: 'asset-variant-a',
    label: 'Edit A',
    prompt: 'Improve the light and make the product feel more premium.',
    module: 'photo-director',
    createdAt: now,
    editStepId: 'step-light',
    qualityScore: 84,
    isFavorite: true,
    modelRuns: ['run-light-a'],
  },
  {
    id: 'version-variant-b',
    projectId: mockProject.id,
    parentVersionId: 'version-variant-a',
    assetId: 'asset-variant-b',
    label: 'A1',
    prompt: 'Create a cleaner ecommerce variant with calm background.',
    module: 'variant-lab',
    createdAt: now,
    editStepId: 'step-variant',
    qualityScore: 89,
    modelRuns: ['run-variant-b'],
  },
];

export const mockEditSteps: EditStep[] = [
  {
    id: 'step-light',
    projectId: mockProject.id,
    fromVersionId: 'version-original',
    toVersionIds: ['version-variant-a'],
    userInstruction: 'Zlepsi svetlo a udelej fotku premium.',
    agentSummary: 'Preserved the product shape and composition, adjusted light and background mood.',
    lockedAreaIds: ['lock-product'],
    visualCanonId: 'canon-demo',
    createdAt: now,
    module: 'photo-director',
  },
  {
    id: 'step-variant',
    projectId: mockProject.id,
    fromVersionId: 'version-variant-a',
    toVersionIds: ['version-variant-b'],
    userInstruction: 'Najdi cistsi variantu pro web.',
    agentSummary: 'Generated a web-focused branch with clean background and stronger product readability.',
    lockedAreaIds: ['lock-product', 'lock-logo'],
    visualCanonId: 'canon-demo',
    createdAt: now,
    module: 'variant-lab',
  },
];

export const mockLockedAreas: LockedArea[] = [
  {
    id: 'lock-product',
    projectId: mockProject.id,
    label: 'Product shape',
    type: 'product',
    description: 'Keep the exact object silhouette, material, and proportions.',
    strictness: 'high',
    createdAt: now,
  },
  {
    id: 'lock-logo',
    projectId: mockProject.id,
    label: 'Logo and label text',
    type: 'logo',
    description: 'Do not invent or distort any visible logo/text.',
    strictness: 'high',
    createdAt: now,
  },
];

export const mockVisualCanon: VisualCanon = {
  id: 'canon-demo',
  projectId: mockProject.id,
  styleSummary: 'Clean premium ecommerce photography with realistic shadows and restrained styling.',
  lighting: 'Soft studio light with gentle highlights and controlled contrast.',
  colorPalette: 'Neutral background, warm product highlights, deep but natural shadows.',
  environment: 'Minimal studio surface with enough negative space for web layouts.',
  cameraLanguage: 'Sharp product-first compositions, medium focal length, no extreme distortion.',
  recurringObjects: [
    {
      id: 'object-product',
      name: 'Hero product',
      description: 'The main object must remain consistent across edits and variants.',
      mustRemainConsistent: true,
    },
  ],
  doNotChange: ['Product proportions', 'Logo/text readability', 'Main composition'],
  avoid: ['Overly AI-looking reflections', 'Random props', 'Changed brand marks'],
  referenceAssetIds: ['asset-original'],
  createdAt: now,
  updatedAt: now,
};

export const mockJobs: GenerationJob[] = [
  {
    id: 'job-variant-lab',
    projectId: mockProject.id,
    module: 'variant-lab',
    status: 'succeeded',
    progress: 100,
    input: {
      variantCount: 8,
      intensity: 'medium',
      targetUse: 'web',
    },
    outputVersionIds: ['version-variant-b'],
    createdAt: now,
    updatedAt: now,
  },
];

export const mockModelRuns: ModelRun[] = [
  {
    id: 'run-light-a',
    jobId: 'job-photo-director',
    provider: 'internal-router',
    model: 'precise-edit',
    inputPrompt: 'Improve light while preserving product and composition.',
    inputAssetIds: ['asset-original'],
    outputAssetId: 'asset-variant-a',
    status: 'succeeded',
    latencyMs: 4200,
    costEstimate: 0.06,
    createdAt: now,
  },
  {
    id: 'run-variant-b',
    jobId: 'job-variant-lab',
    provider: 'internal-router',
    model: 'creative-variation',
    inputPrompt: 'Clean ecommerce direction, preserve product identity.',
    inputAssetIds: ['asset-variant-a'],
    outputAssetId: 'asset-variant-b',
    status: 'succeeded',
    latencyMs: 5100,
    costEstimate: 0.08,
    createdAt: now,
  },
];

export const mockQualityEvaluations: QualityEvaluation[] = [
  {
    id: 'qa-variant-b',
    versionId: 'version-variant-b',
    projectId: mockProject.id,
    identityPreservation: 'high',
    objectPreservation: 'high',
    styleConsistency: 'high',
    commercialUsefulness: 'high',
    artifactRisk: 'low',
    labels: ['Nejlepsi pro web', 'Nejcistsi', 'Vysoka konzistence'],
    summary: 'The product remains readable and the background is cleaner for web use.',
    createdAt: now,
  },
];

export const mockWorkspaceSnapshot: WorkspaceSnapshot = {
  project: mockProject,
  assets: mockAssets,
  versions: mockVersions,
  editSteps: mockEditSteps,
  lockedAreas: mockLockedAreas,
  visualCanon: mockVisualCanon,
  jobs: mockJobs,
  modelRuns: mockModelRuns,
  qualityEvaluations: mockQualityEvaluations,
};
