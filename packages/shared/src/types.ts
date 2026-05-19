export type MulenModule =
  | 'photo-director'
  | 'variant-lab'
  | 'multi-angle-reframe'
  | 'headswap'
  | 'visual-guide'
  | 'infographic-generator';

export type ProjectStatus = 'draft' | 'active' | 'archived';
export type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial' | 'cancelled';
export type PreservationLevel = 'low' | 'medium' | 'high';

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
  status: ProjectStatus;
};

export type AssetKind = 'original' | 'reference' | 'mask' | 'generated' | 'thumbnail' | 'export';

export type Asset = {
  id: string;
  projectId: string;
  userId: string;
  kind: AssetKind;
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

export type LockedAreaType =
  | 'face'
  | 'product'
  | 'logo'
  | 'hands'
  | 'text'
  | 'room'
  | 'composition'
  | 'custom';

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LockedArea = {
  id: string;
  projectId: string;
  label: string;
  type: LockedAreaType;
  maskAssetId?: string;
  boundingBox?: BoundingBox;
  description?: string;
  strictness: PreservationLevel;
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
  status: GenerationStatus;
  progress: number;
  input: Record<string, unknown>;
  outputVersionIds: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type ModelRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type ModelRun = {
  id: string;
  jobId: string;
  provider: string;
  model: string;
  inputPrompt: string;
  inputAssetIds: string[];
  outputAssetId?: string;
  status: ModelRunStatus;
  latencyMs?: number;
  costEstimate?: number;
  error?: string;
  createdAt: string;
};

export type QualityEvaluation = {
  id: string;
  versionId: string;
  projectId: string;
  identityPreservation?: PreservationLevel;
  objectPreservation?: PreservationLevel;
  styleConsistency?: PreservationLevel;
  commercialUsefulness?: PreservationLevel;
  artifactRisk?: PreservationLevel;
  labels: string[];
  summary: string;
  createdAt: string;
};

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

export type WorkspaceSnapshot = {
  project: Project;
  assets: Asset[];
  versions: ImageVersion[];
  editSteps: EditStep[];
  lockedAreas: LockedArea[];
  visualCanon: VisualCanon;
  jobs: GenerationJob[];
  modelRuns: ModelRun[];
  qualityEvaluations: QualityEvaluation[];
};
