import { startTransition, useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, BadgePlus, BookOpen, ChevronDown, Download, Flower2, FolderClosed, Grid2x2, ImageIcon, ImagePlus, ImageUp, List, PanelRight, PencilLine, RefreshCw, Save, Sparkles, Square, Trash2, UserRound, X } from 'lucide-react';
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
} from '@mulen/shared';
import { OutputGallerySection } from './OutputGallery';
import { TimelinePanel } from './Timeline';
import { AssetLibraryPopover } from './AssetLibraryPopover';
import { ImageComparisonModal } from './ImageComparisonModal';
import type { NanoRoute } from '../../types/nano';
import { getNanoRouteLabel, mapNanoRouteToModule } from '../../types/nano';
import { api, fileToDataUrl, setModel, type ApiConfig, type ProviderCatalogItem, type SavedPromptRecord, waitForJob } from '../../lib/api';
import { PromptHistory, type PromptHistoryEntry } from '../../lib/promptHistory';
import { CATEGORY_LABELS, parsePromptToCategories, type PromptCategories } from '../../lib/semanticPromptRemix';

type WorkspaceState = {
  project: Project;
  assets: Asset[];
  versions: ImageVersion[];
  editSteps: EditStep[];
  lockedAreas: LockedArea[];
  visualCanon: VisualCanon;
  jobs: GenerationJob[];
  modelRuns: ModelRun[];
  qualityEvaluations: QualityEvaluation[];
  photoDirectorInstruction: string;
  photoDirectorLockedText: string;
  photoDirectorOutputCount: number;
  photoDirectorAspectRatio: 'original' | 'square' | 'portrait' | 'landscape';
  photoDirectorPolishMode: 'focused' | 'balanced' | 'bold';
  variantLabCount: number;
  variantLabIntensity: 'jemne' | 'stredne' | 'odvazne';
  multiAngleSetType: 'produktova' | 'interier' | 'lifestyle' | 'social';
  multiAngleShotCount: number;
  multiAnglePrecision: 'bezpecna' | 'kreativni';
  headswapHairMode: 'source' | 'target' | 'auto';
  headswapSourceAssetId?: string;
  headswapTargetAssetId?: string;
  styleSlotAssetId?: string;
  brandSlotAssetId?: string;
  headswapNotes: Record<string, string>;
  visualGuidePrompt: string;
  visualGuideStepCount: number;
  visualGuideStyle: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial';
  visualGuideOutput: 'carousel' | 'pdf' | 'blog' | 'web';
  infographicTopic: string;
  infographicType: 'edukacni' | 'srovnavaci' | 'procesni' | 'business';
  infographicFormat: 'A4' | 'square' | 'story' | 'wide';
  infographicTheme: 'light' | 'dark';
  exportFormat: 'png' | 'jpg' | 'pdf' | 'html';
  exportUseCase: 'web' | 'social' | 'print' | 'archive';
  aiUpscalerScale: '2k' | '4k';
  aiUpscalerMode: 'creative' | 'precision';
  aiUpscalerCreativity: number;
  aiUpscalerResemblance: number;
  modelInfluencePrompt: string;
  modelInfluenceStrength: 'low' | 'medium' | 'high';
  styleTransferPrompt: string;
  styleTransferPreserveComposition: boolean;
};

type SavedPrompt = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  category?: string;
};

const SAVED_PROMPTS_STORAGE_KEY = 'mulen-saved-prompts';
const SELECTED_IMAGE_MODEL_STORAGE_KEY = 'mulen-selected-image-model';
const PROMPT_HISTORY_STORAGE_KEY = 'mulen-prompt-history-v1';

type PhotoDirectorProviderUi = 'gemini' | 'chatgpt' | 'flux_pro' | 'grok' | 'replicate';

type ImageModelPreset = {
  id: string;
  provider: PhotoDirectorProviderUi;
  providerLabel: string;
  title: string;
  subtitle: string;
  supportsGrounding: boolean;
  maxImages: number;
};

const FALLBACK_IMAGE_MODEL_PRESETS: ImageModelPreset[] = [
  { id: 'gemini-flash', provider: 'gemini', providerLabel: 'Gemini', title: 'Nano 2', subtitle: 'Gemini 3.1 Flash', supportsGrounding: true, maxImages: 10 },
  { id: 'gemini-pro', provider: 'gemini', providerLabel: 'Gemini', title: 'Nano Pro', subtitle: 'Gemini 3 Pro', supportsGrounding: true, maxImages: 10 },
  { id: 'openai-image', provider: 'chatgpt', providerLabel: 'ChatGPT', title: 'GPT Img 2', subtitle: 'OpenAI', supportsGrounding: false, maxImages: 1 },
  { id: 'flux-pro', provider: 'flux_pro', providerLabel: 'FLUX Pro', title: 'Flux Pro', subtitle: 'fal.ai', supportsGrounding: false, maxImages: 4 },
];

const DEFAULT_SEMANTIC_MIX: Record<keyof PromptCategories, boolean> = {
  subject: false,
  environment: false,
  style: true,
  lighting: true,
  mood: true,
  technical: true,
  other: false,
};

function normalizeSavedPromptRecord(prompt: SavedPromptRecord): SavedPrompt {
  return {
    id: prompt.id,
    name: prompt.name,
    text: prompt.prompt,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    category: prompt.category,
  };
}

function normalizeLegacySavedPromptRecord(item: Partial<SavedPrompt> & { prompt?: string }) {
  const id = String(item.id);
  const text = typeof item.text === 'string' ? item.text : String(item.prompt ?? '');
  const name =
    typeof item.name === 'string' && item.name.trim()
      ? item.name.trim()
      : text.slice(0, 36).trim() || 'Ulozeny prompt';

  return {
    id,
    name,
    text,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    category: typeof item.category === 'string' ? item.category : undefined,
  } satisfies SavedPrompt;
}

function mapProviderCatalogToModelPresets(providers: ProviderCatalogItem[]): ImageModelPreset[] {
  return providers.flatMap((provider) =>
    provider.models
      .filter((model) => model.category === 'image')
      .map((model) => ({
        id: model.id,
        provider: provider.id as PhotoDirectorProviderUi,
        providerLabel: provider.name,
        title: model.label,
        subtitle: provider.name,
        supportsGrounding: provider.supportsGrounding,
        maxImages: provider.maxImages,
      })),
  );
}

const MOCK_GENERATED_IMAGES = [
  'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
];

function filterDeletedEntities(
  snapshot: WorkspaceSnapshot,
  deletedVersionIds: Set<string>,
  deletedJobIds: Set<string>,
): WorkspaceSnapshot {
  if (deletedVersionIds.size === 0 && deletedJobIds.size === 0) return snapshot;

  const jobs = snapshot.jobs
    .filter((job) => !deletedJobIds.has(job.id))
    .map((job) => ({
      ...job,
      outputVersionIds: job.outputVersionIds.filter((versionId) => !deletedVersionIds.has(versionId)),
    }));

  const versions = snapshot.versions.filter((version) => !deletedVersionIds.has(version.id));
  const assetIdsInUse = new Set(versions.map((version) => version.assetId));
  const assets = snapshot.assets.filter((asset) => !assetIdsInUse.size || asset.kind !== 'generated' || assetIdsInUse.has(asset.id));
  const nextActiveVersionId =
    deletedVersionIds.has(snapshot.project.activeVersionId)
      ? (versions.find((version) => version.module === 'photo-director')?.id ??
        versions[0]?.id ??
        snapshot.project.activeVersionId)
      : snapshot.project.activeVersionId;

  return {
    ...snapshot,
    jobs,
    versions,
    assets,
    project: {
      ...snapshot.project,
      activeVersionId: nextActiveVersionId,
    },
  };
}

function createWorkspaceState(snapshot: WorkspaceSnapshot): WorkspaceState {
  return {
    ...snapshot,
    assets: [...snapshot.assets],
    versions: [...snapshot.versions],
    editSteps: [...snapshot.editSteps],
    lockedAreas: [...snapshot.lockedAreas],
    jobs: [...snapshot.jobs],
    modelRuns: [...snapshot.modelRuns],
    qualityEvaluations: [...snapshot.qualityEvaluations],
    visualCanon: {
      ...snapshot.visualCanon,
      recurringObjects: [...snapshot.visualCanon.recurringObjects],
      doNotChange: [...snapshot.visualCanon.doNotChange],
      avoid: [...snapshot.visualCanon.avoid],
      referenceAssetIds: [...snapshot.visualCanon.referenceAssetIds],
    },
    project: { ...snapshot.project },
    photoDirectorInstruction: '',
    photoDirectorLockedText: '',
    photoDirectorOutputCount: 2,
    photoDirectorAspectRatio: 'square',
    photoDirectorPolishMode: 'focused',
    variantLabCount: 8,
    variantLabIntensity: 'stredne',
    multiAngleSetType: 'produktova',
    multiAngleShotCount: 10,
    multiAnglePrecision: 'bezpecna',
    headswapHairMode: 'auto',
    styleSlotAssetId: snapshot.visualCanon.referenceAssetIds.find((assetId) => assetId !== snapshot.project.originalAssetId),
    headswapTargetAssetId: snapshot.project.originalAssetId,
    headswapNotes: {},
    visualGuidePrompt: 'Udelej mi navod jak uvarit pho.',
    visualGuideStepCount: 8,
    visualGuideStyle: 'fotorealisticky',
    visualGuideOutput: 'carousel',
    infographicTopic: 'Rozdil mezi webovou prezentaci a reklamnim kreativem.',
    infographicType: 'srovnavaci',
    infographicFormat: 'A4',
    infographicTheme: 'light',
    exportFormat: 'png',
    exportUseCase: 'web',
    aiUpscalerScale: '2k',
    aiUpscalerMode: 'creative',
    aiUpscalerCreativity: 0.35,
    aiUpscalerResemblance: 0.6,
    modelInfluencePrompt: 'Vylepsi materialy, presnost svetla a pocit finalni reklamni kvality.',
    modelInfluenceStrength: 'medium',
    styleTransferPrompt: 'Premium editorial daylight s cistsim pozadim a jemnejsim stylingem.',
    styleTransferPreserveComposition: true,
  };
}

function getAsset(snapshot: WorkspaceSnapshot, version: ImageVersion): Asset | undefined {
  return snapshot.assets.find((asset) => asset.id === version.assetId);
}

function formatRelativeTimeLabel(createdAt: string) {
  const diffMs = Math.max(0, Date.now() - Date.parse(createdAt));
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatAspectRatioLabel(value?: unknown) {
  switch (value) {
    case 'square':
      return '1:1';
    case 'portrait':
      return '3:4';
    case 'landscape':
      return '4:3';
    case 'original':
    default:
      return '3:4';
  }
}

function isMockLikeAsset(asset: Asset | undefined) {
  if (!asset) return true;
  const url = asset.url || '';
  const path = asset.storagePath || '';
  return (
    url.includes('unsplash.com') ||
    url.includes('images.unsplash') ||
    path.startsWith('mock/') ||
    path.includes('/mock/')
  );
}

function formatModelBadge(model?: string) {
  if (!model) return 'Nano 2';
  if (model.includes('gemini-3.1-flash-image-preview') || model.includes('gemini-flash')) return 'Nano 2';
  if (model.includes('gemini-3-pro-image-preview') || model.includes('gemini-pro')) return 'Nano Pro';
  if (model.includes('gpt-image') || model.includes('openai')) return 'GPT Img 2';
  if (model.includes('flux')) return 'Flux Pro';
  if (model.includes('gemini')) return 'Nano 2';
  return model.replace(/-/g, ' ');
}

function formatSpeedBadge(polishMode?: unknown) {
  if (polishMode === 'bold') return 'exploring';
  return 'thinking fast';
}

/** Maps the aspect ratio label to a CSS aspect-ratio value for card sizing */
function getAspectRatioValue(label?: string): string {
  if (!label) return '1 / 1';
  const lower = label.toLowerCase();
  if (lower === 'portrait' || lower === '3:4') return '3 / 4';
  if (lower === 'landscape' || lower === '4:3') return '4 / 3';
  if (lower === 'square' || lower === '1:1') return '1 / 1';
  // Try to parse "W:H" pattern
  const match = lower.match(/^(\d+):(\d+)$/);
  if (match) return `${match[1]} / ${match[2]}`;
  return '1 / 1';
}

function resolvePhotoDirectorAspectRatio(hasSourceImage: boolean): 'original' | 'square' {
  return hasSourceImage ? 'original' : 'square';
}

function MainCanvas(props: {
  snapshot: WorkspaceState;
  activeRoute: NanoRoute;
  onSelectVersion: (versionId: string) => void;
  onUseVersionAsInput?: (versionId: string) => void;
  onCreateExport: () => void;
  isGenerating: boolean;
  generatingCount?: number;
  onRegenerateVersion?: (versionId: string, prompt: string, referenceAssetIds?: string[]) => Promise<void> | void;
  onUploadReferenceAsset?: (file: File) => Promise<Asset | null>;
  onDeleteVersion?: (versionId: string) => void;
  onDeleteRow?: (jobId: string) => void;
}) {
  const [zoomedVersionId, setZoomedVersionId] = useState<string | null>(null);
  // Feed layout: 'row' (grouped with headers) | 'grid' (flat masonry)
  const [feedLayout, setFeedLayout] = useState<'row' | 'grid'>('row');

  // Detail modal zoom state
  const [modalZoom, setModalZoom] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const modalDragRef = useRef<{ dragging: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  // Detail modal state — Magnific-style full overlay
  const [detailModal, setDetailModal] = useState<{
    cards: Array<{ id: string; versionId: string; url: string; label?: string; resolution: string; prompt: string; aspectRatio: string; modelLabel: string; createdAt: string }>;
    index: number;
  } | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'details' | 'comments'>('details');
  const [modalRegeneratingVersionId, setModalRegeneratingVersionId] = useState<string | null>(null);
  const [modalReferenceAssetIds, setModalReferenceAssetIds] = useState<Record<string, string[]>>({});

  // Session-local generated images (cleared on refresh automatically because state is not persisted)
  const [sessionImages, setSessionImages] = useState<Array<{
    id: string;
    versionId: string;
    url: string;
    prompt: string;
    timestamp: number;
    status: 'loading' | 'success' | 'error';
    error?: string;
  }>>([]);
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({});

  // Sync newly persisted versions into sessionImages (only add, never pre-populate on mount)
  const seenVersionIds = useRef(new Set<string>());
  const isFirstMount = useRef(true);
  const captureGeneratedVersionsRef = useRef(false);

  useEffect(() => {
    const photoVersions = props.snapshot.versions.filter((v: ImageVersion) => v.module === 'photo-director');

    if (isFirstMount.current) {
      photoVersions.forEach((v: ImageVersion) => seenVersionIds.current.add(v.id));
      isFirstMount.current = false;
      return;
    }

    if (!captureGeneratedVersionsRef.current) {
      photoVersions.forEach((v: ImageVersion) => seenVersionIds.current.add(v.id));
      return;
    }

    let addedFromCurrentGeneration = false;
    photoVersions.forEach((version: ImageVersion) => {
      if (!seenVersionIds.current.has(version.id)) {
        seenVersionIds.current.add(version.id);
        const asset = getAsset(props.snapshot, version);
        if (asset && asset.mimeType !== 'text/html') {
          addedFromCurrentGeneration = true;
          setSessionImages(prev => {
            const exists = prev.find(img => img.versionId === version.id);
            if (exists) {
              return prev.map(img => img.versionId === version.id
                ? { ...img, url: asset.url, status: 'success' as const }
                : img
              );
            }
            return [{
              id: version.id,
              versionId: version.id,
              url: asset.url,
              prompt: version.prompt || version.label || props.snapshot.photoDirectorInstruction,
              timestamp: Date.parse(version.createdAt || new Date().toISOString()),
              status: 'success' as const,
            }, ...prev];
          });
        }
      }
    });

    if (addedFromCurrentGeneration && !props.isGenerating) {
      captureGeneratedVersionsRef.current = false;
    }
  }, [props.snapshot.versions]);

  // When generation starts, add loading placeholder(s)
  const prevIsGenerating = useRef(false);
  useEffect(() => {
    if (props.isGenerating && !prevIsGenerating.current) {
      captureGeneratedVersionsRef.current = true;
      const count = props.generatingCount ?? 1;
      const placeholders = Array.from({ length: count }, (_, i) => ({
        id: `loading-${Date.now()}-${i}`,
        versionId: '',
        url: '',
        prompt: props.snapshot.photoDirectorInstruction,
        timestamp: Date.now(),
        status: 'loading' as const,
      }));
      setSessionImages(prev => [...placeholders, ...prev]);
    }
    if (!props.isGenerating && prevIsGenerating.current) {
      // Remove lingering loading placeholders
      setSessionImages(prev => prev.filter(img => img.status !== 'loading'));
    }
    prevIsGenerating.current = props.isGenerating;
  }, [props.isGenerating]);

  const photoDirectorVersions = useMemo(() =>
    props.snapshot.versions.filter((v: ImageVersion) => v.module === 'photo-director'),
  [props.snapshot.versions]);

  const zoomedVersion = useMemo(() =>
    photoDirectorVersions.find((v: ImageVersion) => v.id === zoomedVersionId) || null,
  [photoDirectorVersions, zoomedVersionId]);

  const zoomedAsset = useMemo(() =>
    zoomedVersion ? getAsset(props.snapshot, zoomedVersion) : null,
  [props.snapshot, zoomedVersion]);

  const activeModule = mapNanoRouteToModule(props.activeRoute);
  const activeVersion =
    props.snapshot.versions.find((version: ImageVersion) => version.id === props.snapshot.project.activeVersionId) ?? props.snapshot.versions[0];
  const activeAsset = activeVersion ? getAsset(props.snapshot, activeVersion) : undefined;
  const shouldRenderStageAsset =
    props.activeRoute !== 'mulen' &&
    !!activeAsset &&
    (activeAsset.kind === 'generated' || activeAsset.kind === 'export' || activeVersion?.module === 'infographic-generator');
  const stageConfig = getRouteStageConfig(props.snapshot, props.activeRoute, activeVersion);
  const infographicLayout = activeAsset?.metadata?.layout as
    | { title?: string; theme?: 'light' | 'dark'; sections?: Array<{ title: string; body: string }> }
    | undefined;

  const emptyMarkDots = Array.from({ length: 17 }, (_, index) => index + 1);
  const photoDirectorJobs = useMemo(
    () =>
      props.snapshot.jobs
        .filter((job) => job.module === 'photo-director')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [props.snapshot.jobs],
  );

  const creationRows = useMemo(() => {
    const hasSourceImageForPendingRow = Boolean(props.snapshot.project.originalAssetId);
    const rows = photoDirectorJobs
      .map((job) => {
        const versions = job.outputVersionIds
          .map((versionId) => props.snapshot.versions.find((version) => version.id === versionId))
          .filter(Boolean) as ImageVersion[];
        const cards = versions
          .map((version) => {
            const asset = getAsset(props.snapshot, version);
            if (!asset || asset.mimeType === 'text/html') return null;
            return {
              id: version.id,
              versionId: version.id,
              url: asset.url,
              label: version.label,
              resolution: String(asset.metadata?.resolution ?? '2K'),
            };
          })
          .filter(Boolean) as Array<{ id: string; versionId: string; url: string; label?: string; resolution: string }>;

        if (cards.length === 0) return null;

        const firstVersion = versions[0];
        const firstRun = props.snapshot.modelRuns.find((run) => run.jobId === job.id);
        const prompt =
          (typeof job.input.instruction === 'string' && job.input.instruction.trim()) ||
          firstRun?.inputPrompt ||
          firstVersion?.prompt ||
          'Untitled generation';
        const polishMode =
          (typeof job.input.polishMode === 'string' && job.input.polishMode) ||
          firstVersion?.metadata?.polishMode;

        return {
          id: job.id,
          prompt,
          createdAt: job.createdAt,
          aspectRatio: formatAspectRatioLabel(firstVersion?.metadata?.aspectRatio),
          modelLabel: formatModelBadge(typeof job.input.modelId === 'string' ? job.input.modelId : firstRun?.model),
          speedLabel: formatSpeedBadge(polishMode),
          cards,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      prompt: string;
      createdAt: string;
      aspectRatio: string;
      modelLabel: string;
      speedLabel: string;
      cards: Array<{ id: string; versionId: string; url: string; label?: string; resolution: string }>;
    }>;

    if (props.isGenerating) {
      rows.unshift({
        id: 'pending-generation',
        prompt: props.snapshot.photoDirectorInstruction || 'Generating...',
        createdAt: new Date().toISOString(),
        aspectRatio: formatAspectRatioLabel(resolvePhotoDirectorAspectRatio(hasSourceImageForPendingRow)),
        modelLabel: formatModelBadge(props.snapshot.modelRuns[0]?.model ?? 'gemini-3.1-flash-image-preview'),
        speedLabel: formatSpeedBadge(props.snapshot.photoDirectorPolishMode),
        cards: Array.from({ length: props.generatingCount ?? 1 }, (_, index) => ({
          id: `pending-card-${index}`,
          versionId: '',
          url: '',
          label: 'Generating',
          resolution: '2K',
        })),
      });
    }

    return rows;
  }, [
    photoDirectorJobs,
    props.generatingCount,
    props.isGenerating,
    props.snapshot.modelRuns,
    props.snapshot.photoDirectorInstruction,
    props.snapshot.photoDirectorPolishMode,
    props.snapshot.project.originalAssetId,
    props.snapshot.versions,
    props.snapshot,
  ]);

  const detailCard = detailModal ? detailModal.cards[detailModal.index] : null;
  const detailReferenceAssets = detailCard
    ? (modalReferenceAssetIds[detailCard.versionId] ?? [])
        .map((assetId) => props.snapshot.assets.find((asset: Asset) => asset.id === assetId))
        .filter((asset): asset is Asset => Boolean(asset))
    : [];
  const detailEditPrompt = detailCard ? (editPrompts[detailCard.versionId] ?? detailCard.prompt) : '';

  const handleDetailModalReferenceSelect = (versionId: string, asset: Asset) => {
    setModalReferenceAssetIds((current) => ({
      ...current,
      [versionId]: Array.from(new Set([asset.id, ...(current[versionId] ?? [])])),
    }));
  };

  const handleDetailModalReferenceUpload = async (versionId: string, file: File) => {
    const uploadedAsset = await props.onUploadReferenceAsset?.(file);
    if (!uploadedAsset) return;
    handleDetailModalReferenceSelect(versionId, uploadedAsset);
  };

  const handleDetailModalReferenceRemove = (versionId: string, assetId: string) => {
    setModalReferenceAssetIds((current) => ({
      ...current,
      [versionId]: (current[versionId] ?? []).filter((currentAssetId) => currentAssetId !== assetId),
    }));
  };

  const handleDetailModalRegenerate = async () => {
    if (!detailCard?.versionId || !props.onRegenerateVersion) return;
    const nextPrompt = detailEditPrompt.trim();
    if (!nextPrompt) return;

    try {
      setModalRegeneratingVersionId(detailCard.versionId);
      await props.onRegenerateVersion(detailCard.versionId, nextPrompt, modalReferenceAssetIds[detailCard.versionId] ?? []);
      setDetailModal(null);
    } finally {
      setModalRegeneratingVersionId(null);
    }
  };

  return (
    <main className={props.activeRoute === 'mulen' ? 'main-canvas main-canvas--mulen' : 'main-canvas'}>
      {activeVersion?.module === 'infographic-generator' && infographicLayout ? (
        <div className={infographicLayout.theme === 'dark' ? 'infographic-stage dark' : 'infographic-stage'}>
          <div className="infographic-surface">
            <div className="infographic-kicker">Infographic layout</div>
            <h2>{infographicLayout.title}</h2>
            <div className="infographic-sections">
              {(infographicLayout.sections ?? []).map((section) => (
                <article className="infographic-section-card" key={section.title}>
                  <strong>{section.title}</strong>
                  <p>{section.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={props.activeRoute === 'mulen' ? 'nano-main-results' : 'image-stage nano-image-stage'}>
          {props.activeRoute === 'mulen' ? (
            <>
              <section className="nano-main-results-stage nano-main-results-stage--feed">
                <header className="nano-creations-toolbar">
                  <nav className="nano-creations-tabs" aria-label="Creations navigation">
                    <button type="button" className="active">
                      <Sparkles size={14} />
                      <span>Creations</span>
                    </button>
                    <button type="button">
                      <Grid2x2 size={14} />
                      <span>My templates</span>
                    </button>
                    <button type="button">
                      <BookOpen size={14} />
                      <span>Academy</span>
                    </button>
                  </nav>
                  {/* Right side — Magnific: bg-default-0 relative flex h-8 items-center gap-1 rounded-lg pl-1 pr-2 */}
                  <div className="nano-creations-layout-switcher">
                    <button
                      type="button"
                      data-cy="projects-layout-option-row"
                      className={feedLayout === 'row' ? 'active' : ''}
                      aria-label="Row layout"
                      onClick={() => setFeedLayout('row')}
                    >
                      <List size={14} />
                    </button>
                    <button
                      type="button"
                      data-cy="projects-layout-option-grid"
                      className={feedLayout === 'grid' ? 'active' : ''}
                      aria-label="Grid layout"
                      onClick={() => setFeedLayout('grid')}
                    >
                      <Grid2x2 size={14} />
                    </button>
                  </div>
                </header>
                <div className="nano-creations-feed">
                {creationRows.length === 0 ? (
                  <div className="nano-main-empty-state">
                    <div className="nano-empty-mark nano-empty-mark--animated" aria-hidden="true">
                      {emptyMarkDots.map((dot) => (
                        <span key={dot} />
                      ))}
                    </div>
                    <div className="nano-empty-state">
                      <strong>Zatim zadne vygenerovane obrazky</strong>
                      <p>Zadejte prompt v postrannim panelu (vlevo) a zacnete tvorit</p>
                    </div>
                  </div>
                ) : feedLayout === 'grid' ? (
                  /* ── Flat grid layout — Magnific: all images, no row headers ── */
                  <div className="nano-creation-flat-grid">
                    {creationRows.flatMap(row => row.cards).map(card => {
                      const row = creationRows.find(r => r.cards.some(c => c.id === card.id))!;
                      return (
                        <div key={card.id} className="nano-creation-card-wrap">
                          <div
                            role="button"
                            tabIndex={card.url ? 0 : -1}
                            className={card.url ? 'nano-creation-card' : 'nano-creation-card is-loading'}
                            style={{ aspectRatio: card.url ? getAspectRatioValue(row.aspectRatio) : '1 / 1' }}
                            onClick={() => {
                              if (!card.url) return;
                              const allCards = row.cards.filter(c => c.url).map(c => ({ ...c, prompt: row.prompt, aspectRatio: row.aspectRatio, modelLabel: row.modelLabel, createdAt: row.createdAt }));
                              const clickedIndex = allCards.findIndex(c => c.id === card.id);
                              setDetailModal({ cards: allCards, index: Math.max(0, clickedIndex) }); setDetailModalTab('details'); setModalZoom(1); setModalPan({ x: 0, y: 0 });
                              if (card.versionId) props.onSelectVersion(card.versionId);
                            }}
                          >
                            {card.url ? (
                              <img src={card.url} alt={card.label || row.prompt} />
                            ) : (
                              <div className="nano-creation-card-loading">
                                <p className="nano-creation-card-loading-label">Generuji…</p>
                                <div className="nano-creation-progress-track"><div className="nano-creation-progress-fill" /></div>
                              </div>
                            )}
                            {card.url && (
                              <div className="nano-creation-card-badges">
                                <div className="nano-creation-card-badge"><ImageIcon size={10} /><strong>{card.resolution}</strong></div>
                              </div>
                            )}
                          </div>
                          {card.versionId ? (
                            <button
                              type="button"
                              className="nano-creation-card-delete"
                              aria-label="Smazat obrázek"
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onDeleteVersion?.(card.versionId);
                              }}
                            >
                              <X size={12} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Row layout — Magnific: grouped rows with headers ── */
                  creationRows.map((row) => {
                    return (
                    <article className="nano-creation-row" key={row.id}>
                      {/* Row header — Magnific: rounded-t-xl bg-panel-6 p-3 */}
                      <div className="nano-creation-row-header">
                        <div className="nano-creation-row-header-left">
                          <p className="nano-creation-prompt" title={row.prompt}>{row.prompt}</p>
                          <div className="nano-creation-meta">
                            {row.aspectRatio && <span className="nano-creation-chip">{row.aspectRatio}</span>}
                            {row.modelLabel && <span className="nano-creation-chip">{row.modelLabel}</span>}
                            {row.speedLabel && <span className="nano-creation-chip">{row.speedLabel}</span>}
                          </div>
                        </div>
                        <div className="nano-creation-row-header-right">
                          <span className="nano-creation-time">{formatRelativeTimeLabel(row.createdAt)}</span>
                          {row.id !== 'pending-generation' ? (
                            <button
                              type="button"
                              className="nano-creation-row-delete"
                              aria-label="Smazat řádek"
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onDeleteRow?.(row.id);
                              }}
                            >
                              <X size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {/* Grid — Magnific: grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 px-3 pb-3 bg-panel-6 rounded-b-xl */}
                      <div className="nano-creation-strip">
                        {row.cards.map((card, cardIndex) => {
                          return (
                          <div key={card.id} className="nano-creation-card-wrap">
                            <div
                              role="button"
                              tabIndex={card.url ? 0 : -1}
                              className={card.url ? 'nano-creation-card' : 'nano-creation-card is-loading'}
                              style={{ aspectRatio: card.url ? getAspectRatioValue(row.aspectRatio) : '1 / 1' }}
                              onClick={() => {
                                if (!card.url) return;
                                const allCards = row.cards.filter(c => c.url).map(c => ({ ...c, prompt: row.prompt, aspectRatio: row.aspectRatio, modelLabel: row.modelLabel, createdAt: row.createdAt }));
                                const clickedIndex = allCards.findIndex(c => c.id === card.id);
                                setDetailModal({ cards: allCards, index: Math.max(0, clickedIndex) }); setDetailModalTab('details'); setModalZoom(1); setModalPan({ x: 0, y: 0 });
                                if (card.versionId) props.onSelectVersion(card.versionId);
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && card.url) {
                                  const allCards = row.cards.filter(c => c.url).map(c => ({ ...c, prompt: row.prompt, aspectRatio: row.aspectRatio, modelLabel: row.modelLabel, createdAt: row.createdAt }));
                                  const clickedIndex = allCards.findIndex(c => c.id === card.id);
                                  setDetailModal({ cards: allCards, index: Math.max(0, clickedIndex) }); setDetailModalTab('details'); setModalZoom(1); setModalPan({ x: 0, y: 0 });
                                }
                              }}
                            >
                              {card.url ? (
                                <img src={card.url} alt={card.label || row.prompt} />
                              ) : (
                                <div className="nano-creation-card-loading">
                                  <p className="nano-creation-card-loading-label">
                                    {(row.cards.length > 1) ? `${cardIndex + 1} / ${row.cards.length}` : 'Generuji…'}
                                  </p>
                                  <div className="nano-creation-progress-track"><div className="nano-creation-progress-fill" /></div>
                                </div>
                              )}
                              {card.url && (
                                <div className="nano-creation-card-badges">
                                  <div className="nano-creation-card-badge"><ImageIcon size={10} /><strong>{card.resolution}</strong></div>
                                </div>
                              )}
                            </div>
                            {card.versionId ? (
                              <button
                                type="button"
                                className="nano-creation-card-delete"
                                aria-label="Smazat obrázek"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  props.onDeleteVersion?.(card.versionId);
                                }}
                              >
                                <X size={12} />
                              </button>
                            ) : null}
                          </div>
                          );
                        })}
                      </div>
                    </article>
                    );
                  })
                )}
                </div>
              </section>
            </>
          ) : (
            shouldRenderStageAsset && activeAsset ? (
              <>
                <img alt={activeVersion?.label ?? 'Active version'} src={activeAsset.url} />
                <div className="nano-stage-footer">
                  <strong>{stageConfig.footerTitle}</strong>
                  <p>{stageConfig.footerText}</p>
                </div>
              </>
            ) : (
              <div className="nano-stage-blank" aria-hidden="true" />
            )
          )}
        </div>
      )}

      {/* Zoom modal */}
      <ImageComparisonModal
        isOpen={!!zoomedVersionId}
        onClose={() => setZoomedVersionId(null)}
        generatedImage={zoomedAsset?.url || null}
        originalImage={props.snapshot.assets.find((a: Asset) => a.id === props.snapshot.project.originalAssetId)?.url || null}
        prompt={zoomedVersion?.label || ''}
        timestamp={Date.parse(zoomedVersion?.createdAt || new Date().toISOString())}
        resolution={zoomedAsset?.metadata?.resolution as string}
        aspectRatio={zoomedAsset?.metadata?.aspectRatio as string}
        groundingMetadata={zoomedAsset?.metadata?.groundingMetadata}
        lineage={{
          sourceImageIds: zoomedVersion?.parentVersionId ? [zoomedVersion.parentVersionId] : [],
          styleImageIds: props.snapshot.visualCanon.referenceAssetIds,
          sourceImageUrls: zoomedVersion?.parentVersionId
            ? props.snapshot.versions
                .filter((version) => version.id === zoomedVersion.parentVersionId)
                .map((version) => props.snapshot.assets.find((asset) => asset.id === version.assetId)?.url)
                .filter(Boolean) as string[]
            : [],
          styleImageUrls: props.snapshot.visualCanon.referenceAssetIds
            .map((assetId) => props.snapshot.assets.find((asset) => asset.id === assetId)?.url)
            .filter(Boolean) as string[],
        }}
        versions={photoDirectorVersions.map((version) => ({
          url: props.snapshot.assets.find((asset) => asset.id === version.assetId)?.url ?? '',
          prompt: version.label ?? '',
          timestamp: Date.parse(version.createdAt),
        }))}
        onNext={() => {
          const idx = photoDirectorVersions.findIndex((v: ImageVersion) => v.id === zoomedVersionId);
          if (idx < photoDirectorVersions.length - 1) setZoomedVersionId(photoDirectorVersions[idx + 1].id);
        }}
        onPrev={() => {
          const idx = photoDirectorVersions.findIndex((v: ImageVersion) => v.id === zoomedVersionId);
          if (idx > 0) setZoomedVersionId(photoDirectorVersions[idx - 1].id);
        }}
        hasNext={zoomedVersionId ? photoDirectorVersions.findIndex((v: ImageVersion) => v.id === zoomedVersionId) < photoDirectorVersions.length - 1 : false}
        hasPrev={zoomedVersionId ? photoDirectorVersions.findIndex((v: ImageVersion) => v.id === zoomedVersionId) > 0 : false}
      />

      {props.activeRoute !== 'mulen' ? (
        <div className="memory-drawer">
          <OutputGallerySection
            activeModule={activeModule}
            activeRoute={props.activeRoute}
            snapshot={props.snapshot}
            onSelectVersion={props.onSelectVersion}
          />
        </div>
      ) : null}

      {/* ── Magnific Detail Modal ── */}
      {detailModal && detailCard ? (
        <div
          className="mag-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailModal(null); }}
        >
          <div className="mag-modal">
            <button
              type="button"
              className="mag-modal-close"
              aria-label="Zavřít"
              onClick={() => setDetailModal(null)}
            >
              <X size={16} />
            </button>
            <button
              type="button"
              className="mag-modal-prev"
              disabled={detailModal.index <= 0}
              onClick={() => { setDetailModal((m) => m ? { ...m, index: m.index - 1 } : null); setDetailModalTab('details'); setModalZoom(1); setModalPan({ x: 0, y: 0 }); }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button
              type="button"
              className="mag-modal-next"
              disabled={detailModal.index >= detailModal.cards.length - 1}
              onClick={() => { setDetailModal((m) => m ? { ...m, index: m.index + 1 } : null); setDetailModalTab('details'); setModalZoom(1); setModalPan({ x: 0, y: 0 }); }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
            </button>

            <div
              className="mag-modal-image-side"
              style={{ overflow: 'hidden', cursor: modalZoom > 1 ? 'grab' : 'default' }}
              onWheel={(e) => {
                e.preventDefault();
                const next = Math.max(1, Math.min(8, modalZoom * (e.deltaY < 0 ? 1.12 : 0.89)));
                if (next === 1) setModalPan({ x: 0, y: 0 });
                setModalZoom(next);
              }}
              onMouseDown={(e) => {
                if (modalZoom <= 1) return;
                modalDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPanX: modalPan.x, startPanY: modalPan.y };
                (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
                e.preventDefault();
              }}
              onMouseMove={(e) => {
                if (!modalDragRef.current.dragging) return;
                setModalPan({ x: modalDragRef.current.startPanX + (e.clientX - modalDragRef.current.startX) / modalZoom, y: modalDragRef.current.startPanY + (e.clientY - modalDragRef.current.startY) / modalZoom });
              }}
              onMouseUp={(e) => { modalDragRef.current.dragging = false; (e.currentTarget as HTMLElement).style.cursor = modalZoom > 1 ? 'grab' : 'default'; }}
              onMouseLeave={(e) => { modalDragRef.current.dragging = false; (e.currentTarget as HTMLElement).style.cursor = 'default'; }}
              onDoubleClick={() => { setModalZoom(1); setModalPan({ x: 0, y: 0 }); }}
            >
              <img
                src={detailCard.url}
                alt={detailCard.label || detailCard.prompt}
                style={{ transform: `scale(${modalZoom}) translate(${modalPan.x}px, ${modalPan.y}px)`, transition: modalDragRef.current.dragging ? 'none' : 'transform 0.15s', userSelect: 'none', pointerEvents: 'none' }}
                draggable={false}
              />
            </div>

            <aside className="mag-modal-sidebar">
              <div className="mag-modal-tabs">
                <button
                  type="button"
                  className={detailModalTab === 'details' ? 'mag-modal-tab active' : 'mag-modal-tab'}
                  onClick={() => setDetailModalTab('details')}
                >
                  Details
                </button>
                <button
                  type="button"
                  className={detailModalTab === 'comments' ? 'mag-modal-tab active' : 'mag-modal-tab'}
                  onClick={() => setDetailModalTab('comments')}
                >
                  Comments
                </button>
              </div>

              {detailModalTab === 'details' ? (
                <>
                  <div className="mag-modal-actions">
                    <button
                      type="button"
                      className="mag-modal-action-btn"
                      title="Použít obrázek"
                      onClick={() => {
                        if (detailCard.versionId) props.onSelectVersion(detailCard.versionId);
                        setDetailModal(null);
                      }}
                    >
                      <Sparkles size={14} />
                    </button>
                    <button
                      type="button"
                      className="mag-modal-action-btn"
                      title="Regenerovat obrázek"
                      disabled={modalRegeneratingVersionId === detailCard.versionId}
                      onClick={() => {
                        void handleDetailModalRegenerate();
                      }}
                    >
                      <RefreshCw size={14} />
                    </button>
                    <a
                      href={detailCard.url}
                      download
                      className="mag-modal-action-btn"
                      title="Stáhnout"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={14} />
                    </a>
                    <button
                      type="button"
                      className="mag-modal-action-btn danger"
                      title="Smazat"
                      onClick={() => {
                        if (detailCard.versionId) props.onDeleteVersion?.(detailCard.versionId);
                        setDetailModal(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <p className="mag-modal-timestamp">{formatRelativeTimeLabel(detailCard.createdAt)} · Uloženo v projektu</p>

                  <div>
                    <p className="mag-modal-section-title">Prompt</p>
                    <p className="mag-modal-prompt-text">{detailCard.prompt}</p>
                  </div>

                  <div>
                    <p className="mag-modal-section-title">Settings</p>
                    <div className="mag-modal-badges">
                      {detailCard.aspectRatio && <span className="mag-modal-badge">{detailCard.aspectRatio}</span>}
                      {detailCard.modelLabel && <span className="mag-modal-badge">{detailCard.modelLabel}</span>}
                      {detailCard.resolution && <span className="mag-modal-badge">{detailCard.resolution}</span>}
                    </div>
                  </div>

                  <div className="mag-modal-editor">
                    <div className="mag-modal-editor-head">
                      <div className="mag-modal-editor-label">
                        <PencilLine size={14} />
                        <span>Upravit prompt</span>
                      </div>
                      <AssetLibraryPopover
                        assets={props.snapshot.assets}
                        selectedAssetId={detailReferenceAssets[0]?.id}
                        onSelectAsset={(asset) => handleDetailModalReferenceSelect(detailCard.versionId, asset)}
                        onUploadFile={(file) => {
                          void handleDetailModalReferenceUpload(detailCard.versionId, file);
                        }}
                        includeSamples={false}
                        openOnHover={false}
                        placement="left"
                      >
                        <button type="button" className="mag-modal-add-images-btn">
                          <ImagePlus size={14} />
                          <span>+ Obrázky</span>
                        </button>
                      </AssetLibraryPopover>
                    </div>

                    {detailReferenceAssets.length > 0 ? (
                      <div className="mag-modal-reference-strip">
                        {detailReferenceAssets.map((asset) => (
                          <div key={asset.id} className="mag-modal-reference-chip">
                            <img src={asset.url} alt={asset.storagePath} />
                            <button
                              type="button"
                              aria-label="Odebrat referenci"
                              onClick={() => handleDetailModalReferenceRemove(detailCard.versionId, asset.id)}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <textarea
                      className="mag-modal-editor-textarea"
                      value={detailEditPrompt}
                      onChange={(event) => {
                        const value = event.target.value;
                        setEditPrompts((current) => ({
                          ...current,
                          [detailCard.versionId]: value,
                        }));
                      }}
                    />

                    <button
                      type="button"
                      className="mag-modal-regenerate-btn"
                      disabled={!detailEditPrompt.trim() || modalRegeneratingVersionId === detailCard.versionId}
                      onClick={() => {
                        void handleDetailModalRegenerate();
                      }}
                    >
                      {modalRegeneratingVersionId === detailCard.versionId ? 'Regeneruji obrázek…' : 'Regenerovat obrázek'}
                    </button>
                  </div>

                  <div className="mag-modal-cta-list">
                    <button
                      type="button"
                      className="mag-modal-cta-btn primary"
                      onClick={() => {
                        if (detailCard.versionId) props.onUseVersionAsInput?.(detailCard.versionId);
                        setDetailModal(null);
                      }}
                    >
                      <Sparkles size={13} />
                      Použít obrázek
                    </button>
                  </div>
                </>
              ) : (
                <div className="mag-modal-comments-empty">
                  <p>Comments budou navazovat později. Teď je detail panel připravený pro další editaci a regeneraci obrázku.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </main>
  );
}


function getRouteStageSupplement(
  snapshot: WorkspaceState,
  route: NanoRoute,
  activeVersion?: ImageVersion,
): {
  cards: Array<{
    title: string;
    value?: string;
    subtitle?: string;
    items?: string[];
    previewUrl?: string;
  }>;
} | null {
  const referenceAssets = snapshot.assets.filter((asset) => asset.kind === 'reference');
  const currentRouteVersions = snapshot.versions.filter((version) => {
    const workflow = String(version.metadata?.workflow ?? '');
    switch (route) {
      case 'ai-upscaler':
        return workflow === 'ai-upscaler';
      case 'face-swap':
        return version.module === 'headswap';
      case 'reframe':
        return version.module === 'multi-angle-reframe';
      case 'variant-lab':
        return version.module === 'variant-lab' || workflow === 'model-influence';
      case 'visual-guide':
        return version.module === 'visual-guide';
      case 'infographic':
        return version.module === 'infographic-generator';
      case 'mulen':
      default:
        return version.module === 'photo-director';
    }
  });

  switch (route) {
    case 'face-swap': {
      const sourceAsset = snapshot.assets.find((asset) => asset.id === snapshot.headswapSourceAssetId);
      const targetAsset = snapshot.assets.find((asset) => asset.id === snapshot.headswapTargetAssetId);
      return {
        cards: [
          {
            title: 'Source',
            previewUrl: sourceAsset?.url,
            subtitle: sourceAsset ? 'Zdrojova identita pripravená' : 'Nahraj source face',
          },
          {
            title: 'Target',
            previewUrl: targetAsset?.url,
            subtitle: targetAsset ? 'Cilova scena pripravena' : 'Nahraj target image',
          },
          {
            title: 'Priority',
            items: currentRouteVersions.slice(0, 4).map((version) => String(version.metadata?.headswapLabel ?? version.label)),
            subtitle: `Hair mode: ${snapshot.headswapHairMode}`,
          },
        ],
      };
    }
    case 'reframe':
      return {
        cards: [
          {
            title: 'Set typ',
            value: snapshot.multiAngleSetType,
            subtitle: `${snapshot.multiAngleShotCount} zaberu`,
          },
          {
            title: 'Shot plan',
            items: currentRouteVersions.slice(0, 4).map((version) => version.label ?? 'Shot'),
            subtitle: activeVersion ? `Aktivni: ${activeVersion.label}` : 'Ceka na camera set',
          },
        ],
      };
    case 'variant-lab':
      return {
        cards: [
          {
            title: 'Batch',
            value: `${snapshot.variantLabCount}x`,
            subtitle: `Intenzita ${snapshot.variantLabIntensity}`,
          },
          {
            title: 'Smery',
            items: snapshot.qualityEvaluations
              .filter((evaluation) => currentRouteVersions.some((version) => version.id === evaluation.versionId))
              .slice(0, 4)
              .flatMap((evaluation) => evaluation.labels.slice(0, 1)),
            subtitle: 'Rizene vetveni aktivni fotky',
          },
        ],
      };
    case 'ai-upscaler':
      return {
        cards: [
          {
            title: 'Scale',
            value: snapshot.aiUpscalerScale.toUpperCase(),
            subtitle: snapshot.aiUpscalerMode === 'creative' ? 'Creative' : 'Precision',
          },
          {
            title: 'Reference',
            previewUrl: getAsset(snapshot, activeVersion ?? snapshot.versions[0])?.url,
            subtitle: 'Aktivni branch pro upscale',
          },
        ],
      };
    case 'visual-guide':
      return {
        cards: [
          {
            title: 'Kroky',
            value: `${snapshot.visualGuideStepCount}`,
            subtitle: `${snapshot.visualGuideStyle} · ${snapshot.visualGuideOutput}`,
          },
          {
            title: 'Guide flow',
            items: currentRouteVersions.slice(0, 4).map((version) => version.label ?? 'Krok'),
            subtitle: 'Anchor frame · recurring objects · captions',
          },
        ],
      };
    case 'infographic':
      return {
        cards: [
          {
            title: 'Format',
            value: snapshot.infographicFormat,
            subtitle: `${snapshot.infographicType} · ${snapshot.infographicTheme}`,
          },
          {
            title: 'Layout',
            items: currentRouteVersions.slice(0, 3).map((version) => version.label ?? 'Layout'),
            subtitle: activeVersion ? `Aktivni ${activeVersion.label}` : 'Ceka na render',
          },
        ],
      };
    case 'mulen':
    default:
      return {
        cards: [
          {
            title: 'Locked',
            items: snapshot.lockedAreas.slice(0, 3).map((area) => area.label),
            subtitle: snapshot.photoDirectorLockedText,
          },
          {
            title: 'Canon',
            items: snapshot.visualCanon.doNotChange.slice(0, 3),
            subtitle: `${snapshot.visualCanon.referenceAssetIds.length} referenci v canon`,
          },
        ],
      };
  }
}

function getRouteStageConfig(
  snapshot: WorkspaceState,
  route: NanoRoute,
  activeVersion?: ImageVersion,
) {
  switch (route) {
    case 'ai-upscaler':
      return {
        eyebrow: 'Aktivni upscale',
        title: activeVersion?.label ?? 'Upscale branch',
        subtitle: `Scale ${snapshot.aiUpscalerScale.toUpperCase()} · ${snapshot.aiUpscalerMode}`,
        compareLabel: 'Detail / Full',
        exportLabel: 'Export',
        badges: [snapshot.aiUpscalerScale.toUpperCase(), snapshot.aiUpscalerMode],
        footerTitle: 'Upscale preview',
        footerText: 'Tady sledujeme detail, kresbu hran a cistotu povrchu v nove upscale verzi.',
        emptyMessage: 'Vyber zdrojovy obrazek vlevo a spust upscaler. Mulen vytvori novou detailni verzi do historie projektu.',
      };
    case 'face-swap':
      return {
        eyebrow: 'Aktivni swap',
        title: activeVersion?.label ?? 'Headswap branch',
        subtitle: `Vlasy ${snapshot.headswapHairMode} · 4 paralelni vysledky`,
        compareLabel: 'Source / Target',
        exportLabel: 'Export',
        badges: [
          snapshot.headswapSourceAssetId ? 'Source ready' : 'Source missing',
          snapshot.headswapTargetAssetId ? 'Target ready' : 'Target missing',
          '4 modely',
        ],
        footerTitle: 'Comparison stage',
        footerText: 'Stred drzi aktivni variantu, ale cely workflow je postaveny na porovnani vice swap vysledku a jejich dalsim doladeni.',
        emptyMessage: 'Nahraj source head a target image vlevo. Potom Mulen vygeneruje ctyri swap varianty do stejného projektu.',
      };
    case 'reframe':
      return {
        eyebrow: 'Aktivni camera set',
        title: activeVersion?.label ?? 'Camera branch',
        subtitle: `${snapshot.multiAngleShotCount} zaberu · ${snapshot.multiAnglePrecision}`,
        compareLabel: 'Set / Hero',
        exportLabel: 'Export',
        badges: [
          snapshot.multiAngleSetType,
          `${snapshot.multiAngleShotCount} zaberu`,
          snapshot.multiAnglePrecision,
        ],
        footerTitle: 'Camera set stage',
        footerText: 'Stejny stredovy frame slouzi pro sledovani jednotlivych uhlu, hero zaberu i social cropu v jednom konzistentnim setu.',
        emptyMessage: 'Nahraj zdrojovy zaber vlevo a priprav camera set. Mulen rozvetvi sadu uhlu bez zmeny layoutu aplikace.',
      };
    case 'variant-lab':
      return {
        eyebrow: 'Aktivni batch',
        title: activeVersion?.label ?? 'Variant branch',
        subtitle: `${snapshot.variantLabCount} variant · ${snapshot.variantLabIntensity}`,
        compareLabel: 'Variant / Base',
        exportLabel: 'Export',
        badges: [
          `${snapshot.variantLabCount}x`,
          snapshot.variantLabIntensity,
          'Branching',
        ],
        footerTitle: 'Variant stage',
        footerText: 'Tahle plocha zobrazuje aktivni branch z rizeneho batch generovani a pomaha porovnavat nove smery.',
        emptyMessage: 'Nastav batch prompt vlevo a spust varianty. Mulen vytvori nove vetve, mezi kterymi muzes okamzite prepinat.',
      };
    case 'visual-guide':
      return {
        eyebrow: 'Aktivni guide',
        title: activeVersion?.label ?? 'Guide branch',
        subtitle: `${snapshot.visualGuideStepCount} kroku · ${snapshot.visualGuideStyle}`,
        compareLabel: 'Step / Series',
        exportLabel: 'Export',
        badges: [`${snapshot.visualGuideStepCount} kroku`, snapshot.visualGuideStyle, snapshot.visualGuideOutput],
        footerTitle: 'Guide stage',
        footerText: 'Tahle stage slouzi pro cteni jednotliveho kroku i cele serie navodu, ktera drzi anchor frame a opakujici se objekty.',
        emptyMessage: 'Zadej jednu vetu vlevo a Mulen rozplanuje guide krok za krokem do konzistentni serie.',
      };
    case 'infographic':
      return {
        eyebrow: 'Aktivni layout',
        title: activeVersion?.label ?? 'Infographic branch',
        subtitle: `${snapshot.infographicType} · ${snapshot.infographicFormat}`,
        compareLabel: 'Outline / Layout',
        exportLabel: 'Export',
        badges: [snapshot.infographicType, snapshot.infographicFormat, snapshot.infographicTheme],
        footerTitle: 'Infographic stage',
        footerText: 'Tady vzniká skutecny layout s realnym textem, ne rozbity text v image modelu.',
        emptyMessage: 'Zadej tema nebo vstupni text vlevo a Mulen vyrenderuje infographic jako skutecny layout.',
      };
    case 'mulen':
    default:
      return {
        eyebrow: 'Aktivni verze',
        title: activeVersion?.label ?? 'Bez verze',
        subtitle: 'Photo Director branch',
        compareLabel: 'Before / After',
        exportLabel: 'Export',
        badges: [
          `${snapshot.photoDirectorOutputCount} vystupy`,
          resolvePhotoDirectorAspectRatio(Boolean(snapshot.project.originalAssetId)),
          snapshot.photoDirectorPolishMode,
        ],
        footerTitle: 'Photo Director stage',
        footerText: 'Tady je hlavni stage pro postupne ladeni jedne fotky, jejich dalsich verzi a navazujicich uprav.',
        emptyMessage: 'Zadejte prompt v postrannim panelu vlevo a zacnete tvorit.',
      };
  }
}

function NanoLeftSidebar(props: {
  snapshot: WorkspaceState;
  activeRoute: NanoRoute;
  onGenerate: () => void;
  onGenerateVariants: () => void;
  onInstructionChange: (value: string) => void;
  onLockedTextChange: (value: string) => void;
  onUploadImage: (file: File) => void;
  onUploadReference: (file: File, slot?: 'style' | 'brand') => void;
  onHeadswapSourceUpload: (file: File) => void;
  onHeadswapTargetUpload: (file: File) => void;
  onSelectExistingAsset: (asset: Asset, slot: 'input' | 'style' | 'brand' | 'source-face' | 'target-scene') => void;
  onOutputCountChange: (value: number) => void;
  onVariantCountChange: (value: number) => void;
  onVariantIntensityChange: (value: 'jemne' | 'stredne' | 'odvazne') => void;
  onMultiAngleSetTypeChange: (value: 'produktova' | 'interier' | 'lifestyle' | 'social') => void;
  onMultiAngleShotCountChange: (value: number) => void;
  onMultiAnglePrecisionChange: (value: 'bezpecna' | 'kreativni') => void;
  onHeadswapHairModeChange: (value: 'source' | 'target' | 'auto') => void;
  onUpscalerScaleChange: (value: '2k' | '4k') => void;
  onUpscalerModeChange: (value: 'creative' | 'precision') => void;
  onUpscalerCreativityChange: (value: number) => void;
  onUpscalerResemblanceChange: (value: number) => void;
  onModelInfluencePromptChange: (value: string) => void;
  onModelInfluenceStrengthChange: (value: 'low' | 'medium' | 'high') => void;
  onStyleTransferPromptChange: (value: string) => void;
  onStyleTransferPreserveCompositionChange: (value: boolean) => void;
  onVisualGuidePromptChange: (value: string) => void;
  onVisualGuideStepCountChange: (value: number) => void;
  onVisualGuideStyleChange: (value: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial') => void;
  onInfographicTopicChange: (value: string) => void;
  onInfographicFormatChange: (value: 'A4' | 'square' | 'story' | 'wide') => void;
  onInfographicThemeChange: (value: 'light' | 'dark') => void;
  onPrimaryAction: () => void;
  isGenerating: boolean;
  onEnhancePrompt: () => void;
  onUndoPromptEnhance: () => void;
  onRedoPromptHistory: () => void;
  onSelectPromptHistoryEntry: (entryId: string) => void;
  onGeneratePromptVariants: () => void;
  onApplyPromptVariant: (prompt: string) => void;
  onSemanticReferencePromptChange: (value: string) => void;
  onToggleSemanticMixCategory: (key: keyof PromptCategories) => void;
  onRunSemanticPromptRemix: () => void;
  onOpenSavePrompt: () => void;
  onSavePrompt: () => void;
  onLoadPrompt: (text: string) => void;
  onDeletePrompt: (id: string) => void;
  onSelectSavedPrompt: (id: string) => void;
  onPromptModeChange: (value: 'simple' | 'advanced') => void;
  onAdvancedVariantChange: (value: 'A' | 'B' | 'C') => void;
  onFaceIdentityModeChange: (value: boolean) => void;
  advancedVariant: 'A' | 'B' | 'C';
  faceIdentityMode: boolean;
  promptMode: 'simple' | 'advanced';
  canEnhancePrompt: boolean;
  canUndoPromptEnhance: boolean;
  canRedoPromptHistory: boolean;
  canSavePrompt: boolean;
  isEnhancingPrompt: boolean;
  isSemanticRemixing: boolean;
  isGeneratingPromptVariants: boolean;
  enhanceError: string | null;
  savedPrompts: SavedPrompt[];
  isSavedPromptsOpen: boolean;
  onToggleSavedPrompts: () => void;
  isSavePromptOpen: boolean;
  savedPromptDraftName: string;
  onSavedPromptDraftNameChange: (value: string) => void;
  onCloseSavePrompt: () => void;
  selectedSavedPromptId: string | null;
  canGenerate: boolean;
  currentPrompt: string;
  semanticReferencePrompt: string;
  semanticMixSelection: Record<keyof PromptCategories, boolean>;
  semanticPromptVariants: Array<{ variant: string; approach: string; prompt: string }>;
  promptHistoryEntries: PromptHistoryEntry[];
  currentPromptHistoryEntryId: string | null;
  imageModelPresets: ImageModelPreset[];
  selectedModelId?: string;
  onModelSelect?: (modelId: string) => void;
}) {
  const imageModelPresets = props.imageModelPresets;
  const referenceAssets = props.snapshot.assets.filter((asset) => asset.kind === 'reference');
  const originalAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.project.originalAssetId);
  const headswapSourceAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.headswapSourceAssetId);
  const headswapTargetAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.headswapTargetAssetId);
  const styleSlotAsset =
    props.snapshot.assets.find((asset) => asset.id === props.snapshot.styleSlotAssetId) ?? referenceAssets[0];
  const brandSlotAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.brandSlotAssetId);
  const [dragSection, setDragSection] = useState<'input' | 'style' | 'brand' | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isReferenceMenuOpen, setIsReferenceMenuOpen] = useState(false);
  const [isAiPromptMenuOpen, setIsAiPromptMenuOpen] = useState(false);
  const [aiPromptPanel, setAiPromptPanel] = useState<'enhance' | 'semantic' | 'variants' | 'history'>('semantic');
  const promptToolbarRef = useRef<HTMLDivElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const referenceMenuRef = useRef<HTMLDivElement | null>(null);
  const aiPromptMenuRef = useRef<HTMLDivElement | null>(null);
  const route = props.activeRoute;
  const selectedModel =
    imageModelPresets.find((preset) => preset.id === props.selectedModelId) ?? imageModelPresets[0];
  const modelGroups = imageModelPresets.reduce<Record<string, ImageModelPreset[]>>((acc, preset) => {
    if (!acc[preset.providerLabel]) acc[preset.providerLabel] = [];
    acc[preset.providerLabel].push(preset);
    return acc;
  }, {});
  const referenceOptions = [
    { id: 'A', label: 'Authentic', description: 'Keeps the output natural and closest to the original feel.', icon: Sparkles },
    { id: 'B', label: 'Enhance', description: 'Adds more polish, clarity and commercial finish.', icon: BadgePlus },
    { id: 'C', label: 'Balance', description: 'Balanced mix between realism, cleanup and creative lift.', icon: Flower2 },
    { id: 'face-id', label: 'Face ID', description: 'Preserves facial identity more strictly across edits.', icon: UserRound },
  ] as const;
  const selectedReferenceOption =
    props.faceIdentityMode
      ? referenceOptions[3]
      : referenceOptions.find((option) => option.id === props.advancedVariant) ?? referenceOptions[2];
  const semanticReferenceCategories = useMemo(
    () => parsePromptToCategories(props.semanticReferencePrompt),
    [props.semanticReferencePrompt],
  );

  const handleFile = (fileList: FileList | File[], mode: 'input' | 'style' | 'brand' | 'source-face' | 'target-scene') => {
    const file = Array.from(fileList).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    if (mode === 'source-face') {
      props.onHeadswapSourceUpload(file);
      return;
    }
    if (mode === 'target-scene') {
      props.onHeadswapTargetUpload(file);
      return;
    }
    if (mode === 'input') props.onUploadImage(file);
    else props.onUploadReference(file, mode === 'brand' ? 'brand' : 'style');
  };
  const uploadConfigs = getRouteUploadConfigs({
    route,
    originalAsset,
    referenceAssets,
    lockedCount: props.snapshot.lockedAreas.length,
    headswapSourceAsset,
    headswapTargetAsset,
    styleSlotAsset,
    brandSlotAsset,
  });
  const commandConfig = getRouteCommandConfig(props.snapshot, route, {
    onOutputCountChange: props.onOutputCountChange,
    onVariantCountChange: props.onVariantCountChange,
    onVariantIntensityChange: props.onVariantIntensityChange,
    onMultiAngleShotCountChange: props.onMultiAngleShotCountChange,
    onMultiAnglePrecisionChange: props.onMultiAnglePrecisionChange,
    onHeadswapHairModeChange: props.onHeadswapHairModeChange,
    onUpscalerScaleChange: props.onUpscalerScaleChange,
    onUpscalerModeChange: props.onUpscalerModeChange,
    onModelInfluenceStrengthChange: props.onModelInfluenceStrengthChange,
    onStyleTransferPreserveCompositionChange: props.onStyleTransferPreserveCompositionChange,
    onVisualGuideStepCountChange: props.onVisualGuideStepCountChange,
    onVisualGuideStyleChange: props.onVisualGuideStyleChange,
    onInfographicFormatChange: props.onInfographicFormatChange,
    onInfographicThemeChange: props.onInfographicThemeChange,
  });
  const selectedSavedPrompt =
    props.savedPrompts.find((prompt) => prompt.id === props.selectedSavedPromptId) ?? props.savedPrompts[0] ?? null;
  const previewPrompts = props.savedPrompts.length
    ? props.savedPrompts
    : [
        {
          id: 'prompt-demo-1',
          name: 'Editorial food mood',
          text: 'Fresh salmon plated on a rustic table in a refined restaurant interior, natural light, elegant editorial food photography, crisp details, premium atmosphere.',
          createdAt: new Date().toISOString(),
        },
      ];

  useEffect(() => {
    if ((!props.isSavedPromptsOpen && !props.isSavePromptOpen) || typeof window === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (promptToolbarRef.current?.contains(target)) return;
      if (props.isSavedPromptsOpen) props.onToggleSavedPrompts();
      if (props.isSavePromptOpen) props.onCloseSavePrompt();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [props.isSavedPromptsOpen, props.isSavePromptOpen, props.onToggleSavedPrompts, props.onCloseSavePrompt]);

  useEffect(() => {
    if (!isModelMenuOpen || typeof window === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (modelMenuRef.current?.contains(target)) return;
      setIsModelMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isModelMenuOpen]);

  useEffect(() => {
    if (!isReferenceMenuOpen || typeof window === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (referenceMenuRef.current?.contains(target)) return;
      setIsReferenceMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isReferenceMenuOpen]);

  useEffect(() => {
    if (!isAiPromptMenuOpen || typeof window === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (aiPromptMenuRef.current?.contains(target)) return;
      setIsAiPromptMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isAiPromptMenuOpen]);

  return (
    <aside className="nano-left-panel">
      <section className="nano-action-panel">
        <button className={`nano-generate-button ${props.canGenerate ? 'ready' : ''}`} disabled={!props.canGenerate || props.isGenerating} onClick={props.onPrimaryAction} type="button">
          <span>{commandConfig.primaryLabel}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
            <path d="M19 3v4" />
            <path d="M21 5h-4" />
            <path d="M5 17v2" />
            <path d="M6 18H4" />
          </svg>
        </button>
        <div className="nano-mini-actions">
          {commandConfig.quickActions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick}>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
        <div className="nano-model-select-block" ref={modelMenuRef}>
          <p>Model</p>
          <button
            type="button"
            className={`nano-model-select-trigger ${isModelMenuOpen ? 'open' : ''}`}
            onClick={() => setIsModelMenuOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={isModelMenuOpen}
          >
            <span className="nano-model-select-leading" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="m12 2 2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2L12 2Z" />
                <path d="M6 14.5 7.1 17 9.5 18.1 7.1 19.2 6 21.5 4.9 19.2 2.5 18.1 4.9 17 6 14.5Z" />
              </svg>
            </span>
            <span className="nano-model-select-copy">
              <strong>{selectedModel.title}</strong>
            </span>
            <span className="nano-model-select-chevron" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
          {isModelMenuOpen ? (
            <div className="nano-model-select-menu" role="listbox" aria-label="Model selection">
              {Object.entries(modelGroups).map(([providerLabel, models]) => (
                <div key={providerLabel} className="nano-model-provider-group">
                  <div className="nano-model-provider-head">
                    <strong>{providerLabel}</strong>
                    <span>
                      {models[0]?.supportsGrounding ? 'Grounding' : 'No grounding'} · max {models[0]?.maxImages ?? 1}
                    </span>
                  </div>
                  {models.map((preset) => {
                    const isActive = preset.id === selectedModel.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={isActive ? 'nano-model-select-option active' : 'nano-model-select-option'}
                        onClick={() => {
                          props.onModelSelect?.(preset.id);
                          setIsModelMenuOpen(false);
                        }}
                        role="option"
                        aria-selected={isActive}
                      >
                        <strong>{preset.title}</strong>
                        <span>{preset.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="nano-count-picker">
          <p>{commandConfig.optionRowLabel}</p>
          <div className="nano-count-row">
            {commandConfig.optionRow.map((option) => (
              <button
                key={option.label}
                type="button"
                className={option.active ? 'active' : ''}
                onClick={option.onClick}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="nano-prompt-card">
          {route === 'mulen' ? (
            <>
              <div className="nano-prompt-label">
                <strong>PROMPT</strong>
              </div>
              <div className="nano-prompt-surface">
                <textarea
                  value={props.snapshot.photoDirectorInstruction}
                  onChange={(event) => props.onInstructionChange(event.target.value)}
                  placeholder="Describe your image-try @ to add references"
                  className="nano-prompt-surface-textarea"
                />
                <div className="nano-prompt-surface-footer">
                  <div className="nano-ai-prompt-wrap" ref={aiPromptMenuRef}>
                    <button
                      type="button"
                      className="nano-ai-prompt-button"
                      disabled={!props.canEnhancePrompt}
                      onClick={() => setIsAiPromptMenuOpen((current) => !current)}
                    >
                      <span className="nano-ai-prompt-switch" aria-hidden="true">
                        <i />
                      </span>
                      <span>{props.isEnhancingPrompt || props.isSemanticRemixing ? 'AI prompt...' : 'AI prompt'}</span>
                    </button>
                    {isAiPromptMenuOpen ? (
                      <div className="nano-inline-prompt-popover nano-inline-prompt-popover--floating nano-ai-prompt-popover">
                        <div className="nano-ai-prompt-tabs">
                          {[
                            { id: 'semantic', label: 'Semantic' },
                            { id: 'variants', label: '3 variants' },
                            { id: 'history', label: 'History' },
                            { id: 'enhance', label: 'Enhance' },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              className={aiPromptPanel === tab.id ? 'active' : ''}
                              onClick={() => setAiPromptPanel(tab.id as typeof aiPromptPanel)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {aiPromptPanel === 'enhance' ? (
                          <div className="nano-ai-panel-section">
                            <p>AI prompt vylepší stávající text bez změny významu.</p>
                            <button
                              type="button"
                              className="nano-ai-panel-primary"
                              disabled={!props.canEnhancePrompt || props.isEnhancingPrompt}
                              onClick={props.onEnhancePrompt}
                            >
                              {props.isEnhancingPrompt ? 'Vylepšuji…' : 'Vylepšit prompt'}
                            </button>
                          </div>
                        ) : null}

                        {aiPromptPanel === 'semantic' ? (
                          <div className="nano-ai-panel-section">
                            <p>Vlož druhý prompt a vyber, které významové části chceš převzít.</p>
                            <textarea
                              value={props.semanticReferencePrompt}
                              onChange={(event) => props.onSemanticReferencePromptChange(event.target.value)}
                              placeholder="Reference prompt pro semantic remix"
                              className="nano-ai-panel-textarea"
                            />
                            <div className="nano-ai-category-preview">
                              {(Object.keys(CATEGORY_LABELS) as Array<keyof PromptCategories>)
                                .filter((key) => semanticReferenceCategories[key].trim())
                                .map((key) => (
                                  <span key={key}>{CATEGORY_LABELS[key]}</span>
                                ))}
                            </div>
                            <div className="nano-ai-mix-grid">
                              {(Object.keys(CATEGORY_LABELS) as Array<keyof PromptCategories>).map((key) => (
                                <button
                                  key={key}
                                  type="button"
                                  className={props.semanticMixSelection[key] ? 'active' : ''}
                                  onClick={() => props.onToggleSemanticMixCategory(key)}
                                >
                                  {CATEGORY_LABELS[key]}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="nano-ai-panel-primary"
                              disabled={!props.currentPrompt.trim() || !props.semanticReferencePrompt.trim() || props.isSemanticRemixing}
                              onClick={props.onRunSemanticPromptRemix}
                            >
                              {props.isSemanticRemixing ? 'Míchám…' : 'Použít semantic remix'}
                            </button>
                          </div>
                        ) : null}

                        {aiPromptPanel === 'variants' ? (
                          <div className="nano-ai-panel-section">
                            <div className="nano-ai-panel-headline">
                              <p>Vygeneruj 3 alternativní formulace promptu a jedním klikem je vlož.</p>
                              <button
                                type="button"
                                className="nano-ai-panel-secondary"
                                disabled={!props.currentPrompt.trim() || props.isGeneratingPromptVariants}
                                onClick={props.onGeneratePromptVariants}
                              >
                                {props.isGeneratingPromptVariants ? 'Generuji…' : 'Vytvořit varianty'}
                              </button>
                            </div>
                            <div className="nano-ai-variants-list">
                              {props.semanticPromptVariants.length ? (
                                props.semanticPromptVariants.map((variant) => (
                                  <button key={variant.variant} type="button" className="nano-ai-variant-card" onClick={() => props.onApplyPromptVariant(variant.prompt)}>
                                    <strong>{variant.variant}</strong>
                                    <span>{variant.approach}</span>
                                    <p>{variant.prompt}</p>
                                  </button>
                                ))
                              ) : (
                                <p className="nano-ai-panel-empty">Zatím tu nejsou vygenerované varianty.</p>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {aiPromptPanel === 'history' ? (
                          <div className="nano-ai-panel-section">
                            <div className="nano-ai-history-actions">
                              <button type="button" className="nano-ai-panel-secondary" disabled={!props.canUndoPromptEnhance} onClick={props.onUndoPromptEnhance}>
                                Zpět
                              </button>
                              <button type="button" className="nano-ai-panel-secondary" disabled={!props.canRedoPromptHistory} onClick={props.onRedoPromptHistory}>
                                Znovu
                              </button>
                            </div>
                            <div className="nano-ai-history-list">
                              {props.promptHistoryEntries.length ? (
                                props.promptHistoryEntries.map((entry) => (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    className={entry.id === props.currentPromptHistoryEntryId ? 'nano-ai-history-card active' : 'nano-ai-history-card'}
                                    onClick={() => props.onSelectPromptHistoryEntry(entry.id)}
                                  >
                                    <span>{new Date(entry.createdAt).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    <p>{entry.prompt}</p>
                                  </button>
                                ))
                              ) : (
                                <p className="nano-ai-panel-empty">Historie promptu je zatím prázdná.</p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="nano-prompt-tools-row" ref={promptToolbarRef}>
                    <button
                      type="button"
                      className="nano-prompt-tool-icon"
                      onClick={props.onUndoPromptEnhance}
                      disabled={!props.canUndoPromptEnhance}
                      title="Undo"
                      aria-label="Undo"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="nano-prompt-tool-icon"
                      onClick={props.onOpenSavePrompt}
                      disabled={!props.canSavePrompt}
                      title="Save prompt"
                      aria-label="Save prompt"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      className="nano-prompt-tool-icon"
                      onClick={props.onToggleSavedPrompts}
                      title="My prompts"
                      aria-label="My prompts"
                    >
                      <FolderClosed size={14} />
                    </button>
                    {props.isSavePromptOpen ? (
                      <div className="nano-inline-prompt-popover nano-inline-prompt-popover--floating">
                        <input
                          type="text"
                          value={props.savedPromptDraftName}
                          onChange={(event) => props.onSavedPromptDraftNameChange(event.target.value)}
                          placeholder="Prompt name"
                          className="nano-prompt-name-input"
                        />
                        <div className="nano-prompt-popover-actions">
                          <button type="button" className="nano-prompt-popover-button subtle" onClick={props.onCloseSavePrompt}>
                            Cancel
                          </button>
                          <button type="button" className="nano-prompt-popover-button" onClick={props.onSavePrompt}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {props.isSavedPromptsOpen ? (
                      <div className="nano-inline-prompt-popover nano-inline-prompt-popover--floating nano-inline-prompt-library">
                        <div className="nano-prompt-library-head">
                          <span>Saved prompts</span>
                        </div>
                        {previewPrompts.map((prompt) => (
                          <button key={prompt.id} type="button" className="nano-prompt-library-item" onClick={() => props.onLoadPrompt(prompt.text)}>
                            <strong>{prompt.name}</strong>
                            <span>{new Date(prompt.createdAt).toLocaleDateString('cs-CZ')}</span>
                            <p className="nano-prompt-library-text">{prompt.text}</p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="nano-prompt-header">
                <strong>{commandConfig.cardTitle}</strong>
              </div>
              {renderRouteCommandBody({
                route,
                snapshot: props.snapshot,
                onInstructionChange: props.onInstructionChange,
                onLockedTextChange: props.onLockedTextChange,
                onUpscalerScaleChange: props.onUpscalerScaleChange,
                onUpscalerModeChange: props.onUpscalerModeChange,
                onUpscalerCreativityChange: props.onUpscalerCreativityChange,
                onUpscalerResemblanceChange: props.onUpscalerResemblanceChange,
                onVariantCountChange: props.onVariantCountChange,
                onVariantIntensityChange: props.onVariantIntensityChange,
                onMultiAngleSetTypeChange: props.onMultiAngleSetTypeChange,
                onMultiAngleShotCountChange: props.onMultiAngleShotCountChange,
                onMultiAnglePrecisionChange: props.onMultiAnglePrecisionChange,
                onHeadswapHairModeChange: props.onHeadswapHairModeChange,
                onModelInfluencePromptChange: props.onModelInfluencePromptChange,
                onModelInfluenceStrengthChange: props.onModelInfluenceStrengthChange,
                onStyleTransferPromptChange: props.onStyleTransferPromptChange,
                onStyleTransferPreserveCompositionChange: props.onStyleTransferPreserveCompositionChange,
                onVisualGuidePromptChange: props.onVisualGuidePromptChange,
                onVisualGuideStepCountChange: props.onVisualGuideStepCountChange,
                onVisualGuideStyleChange: props.onVisualGuideStyleChange,
                onInfographicTopicChange: props.onInfographicTopicChange,
                onInfographicFormatChange: props.onInfographicFormatChange,
                onInfographicThemeChange: props.onInfographicThemeChange,
                promptMode: props.promptMode,
              })}
            </>
          )}
          {route === 'mulen' ? (
            <>
              <div className="nano-reference-block" ref={referenceMenuRef}>
                <strong>Preferences</strong>
                <button
                  type="button"
                  className={`nano-model-select-trigger nano-reference-select-trigger ${isReferenceMenuOpen ? 'open' : ''}`}
                  onClick={() => setIsReferenceMenuOpen((current) => !current)}
                  aria-haspopup="listbox"
                  aria-expanded={isReferenceMenuOpen}
                >
                  <span className="nano-model-select-leading" aria-hidden="true">
                    {(() => {
                      const Icon = selectedReferenceOption.icon;
                      return <Icon size={16} strokeWidth={2} />;
                    })()}
                  </span>
                  <span className="nano-model-select-copy">
                    <strong>{selectedReferenceOption.label}</strong>
                  </span>
                  <span className="nano-model-select-chevron" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </button>
                {isReferenceMenuOpen ? (
                  <div className="nano-model-select-menu nano-reference-select-menu" role="listbox" aria-label="Reference preference selection">
                    {referenceOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = option.id === 'face-id' ? props.faceIdentityMode : props.advancedVariant === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={isActive ? 'nano-model-select-option active nano-reference-select-option' : 'nano-model-select-option nano-reference-select-option'}
                          onClick={() => {
                            if (option.id === 'face-id') {
                              props.onFaceIdentityModeChange?.(true);
                            } else {
                              props.onFaceIdentityModeChange?.(false);
                              props.onAdvancedVariantChange?.(option.id as 'A' | 'B' | 'C');
                            }
                            setIsReferenceMenuOpen(false);
                          }}
                          role="option"
                          aria-selected={isActive}
                        >
                          <span className="nano-reference-select-option-icon" aria-hidden="true">
                            <Icon size={15} strokeWidth={2} />
                          </span>
                          <div className="nano-reference-select-option-copy">
                            <strong>{option.label}</strong>
                            <span>{option.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          {isPromptEnhanceableRoute(route) && route !== 'mulen' ? (
            <div className="nano-prompt-enhancer" ref={promptToolbarRef}>
              <button
                type="button"
                className="nano-prompt-toolcell nano-prompt-toolcell-primary"
                disabled={!props.canEnhancePrompt || props.isEnhancingPrompt}
                onClick={props.onEnhancePrompt}
              >
                {props.isEnhancingPrompt ? 'Vylepsuji prompt...' : 'Vylepsit prompt'}
              </button>
              <button
                type="button"
                className="nano-prompt-toolcell"
                disabled={!props.canUndoPromptEnhance}
                onClick={props.onUndoPromptEnhance}
              >
                Vratit zpet
              </button>
              <div className="nano-prompt-toolbar-popover">
                <button
                  type="button"
                  className="nano-prompt-toolcell"
                  disabled={!props.canSavePrompt}
                  onClick={props.onOpenSavePrompt}
                >
                  Ulozit prompt
                </button>
                {props.isSavePromptOpen ? (
                  <div className="nano-prompt-popover nano-prompt-save-popover">
                    <div className="nano-prompt-popover-head">
                      <strong>Pojmenovat prompt</strong>
                    </div>
                    <input
                      type="text"
                      value={props.savedPromptDraftName}
                      onChange={(event) => props.onSavedPromptDraftNameChange(event.target.value)}
                      placeholder="Napriklad produktove svetlo"
                      className="nano-prompt-name-input"
                    />
                    <div className="nano-prompt-popover-actions">
                      <button type="button" className="nano-prompt-popover-button" onClick={props.onSavePrompt}>
                        Ulozit
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="nano-prompt-toolbar-popover">
                <button type="button" className="nano-prompt-toolcell" onClick={props.onToggleSavedPrompts}>
                  Moje prompty
                </button>
                {props.isSavedPromptsOpen ? (
                  <div className="nano-prompt-popover nano-prompt-library-popover">
                    <div className="nano-prompt-library-columns">
                      <div className="nano-prompt-library-list">
                        <div className="nano-prompt-popover-head">
                          <strong>Ulozene prompty</strong>
                        </div>
                        {props.savedPrompts.length ? (
                          props.savedPrompts.map((prompt) => (
                            <button
                              type="button"
                              key={prompt.id}
                              className={prompt.id === selectedSavedPrompt?.id ? 'nano-prompt-library-item active' : 'nano-prompt-library-item'}
                              onClick={() => props.onSelectSavedPrompt(prompt.id)}
                            >
                              <strong>{prompt.name}</strong>
                              <span>{new Date(prompt.createdAt).toLocaleDateString('cs-CZ')}</span>
                            </button>
                          ))
                        ) : (
                          <p className="nano-prompt-dropdown-empty">Zatim zadne ulozene prompty.</p>
                        )}
                      </div>
                      <div className="nano-prompt-library-detail">
                        {selectedSavedPrompt ? (
                          <>
                            <div className="nano-prompt-popover-head">
                              <strong>{selectedSavedPrompt.name}</strong>
                            </div>
                            <pre className="nano-prompt-library-text">{selectedSavedPrompt.text}</pre>
                            <div className="nano-prompt-popover-actions">
                              <button
                                type="button"
                                className="nano-prompt-popover-button"
                                onClick={() => props.onLoadPrompt(selectedSavedPrompt.text)}
                              >
                                Vlozit
                              </button>
                              <button
                                type="button"
                                className="nano-prompt-popover-button subtle"
                                onClick={() => props.onDeletePrompt(selectedSavedPrompt.id)}
                              >
                                Smazat
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="nano-prompt-dropdown-empty">Vyberte prompt vlevo.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {props.enhanceError ? <p className="nano-prompt-enhance-error">{props.enhanceError}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="nano-input-sections">
        {uploadConfigs.map((config) => (
          <div key={config.id}>
            <AssetLibraryPopover
              assets={props.snapshot.assets}
              selectedAssetId={config.asset?.id}
              onUploadFile={(file) => handleFile([file], config.mode)}
              onSelectAsset={(asset) => props.onSelectExistingAsset(asset, config.mode)}
              openOnHover={false}
            >
              <UploadSection
                asset={config.asset}
                assets={config.asset ? [config.asset] : []}
                count={config.count}
                browseViaPopover
                dragging={dragSection === config.dragKey}
                onBrowse={() => document.getElementById(config.id)?.click()}
                onDropFiles={(files) => handleFile(files, config.mode)}
                onDragStateChange={(active) => setDragSection(active ? config.dragKey : null)}
                title={config.title}
                helper={config.helper}
              />
            </AssetLibraryPopover>
            <input
              id={config.id}
              className="upload-input hidden-upload-input"
              accept="image/*"
              type="file"
              onChange={(event) => {
                if (event.target.files) handleFile(event.target.files, config.mode);
              }}
            />
          </div>
        ))}
      </section>
    </aside>
  );
}

function UploadSection(props: {
  title: string;
  count: number;
  dragging: boolean;
  asset?: Asset;
  assets?: Asset[];
  helper?: string;
  onBrowse: () => void;
  onDropFiles: (files: FileList) => void;
  onDragStateChange: (active: boolean) => void;
  browseViaPopover?: boolean;
}) {
  const visibleAssets = (props.assets ?? (props.asset ? [props.asset] : [])).slice(0, 4);

  return (
    <section className="nano-upload-section">
      <div className="nano-upload-heading">
        <strong>{props.title}</strong>
        <span>{props.count}</span>
      </div>
      <div
        className={
          props.dragging
            ? 'nano-upload-box dragging'
            : visibleAssets.length
              ? 'nano-upload-box has-asset'
              : 'nano-upload-box'
        }
        onClick={(event) => {
          if (event.target === event.currentTarget && !props.browseViaPopover) props.onBrowse();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          props.onDragStateChange(true);
        }}
        onDragLeave={() => props.onDragStateChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          props.onDragStateChange(false);
          if (event.dataTransfer.files) props.onDropFiles(event.dataTransfer.files);
        }}
      >
        {visibleAssets.length ? (
          <div className="nano-upload-box-strip">
            {visibleAssets.map((asset, index) => (
              <div key={asset.id} className="nano-upload-thumb" title={asset.storagePath || `${props.title} ${index + 1}`}>
                <img className="nano-upload-box-preview" alt={props.title} src={asset.url} />
              </div>
            ))}
            <button
              type="button"
              className="nano-upload-thumb nano-upload-thumb-add"
              onClick={(event) => {
                if (props.browseViaPopover) return;
                event.stopPropagation();
                props.onBrowse();
              }}
              aria-label={`Add ${props.title.toLowerCase()}`}
            >
              <span className="nano-upload-thumb-add-plus" aria-hidden="true">+</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="nano-upload-box-empty"
            onClick={(event) => {
              if (props.browseViaPopover) return;
              event.stopPropagation();
              props.onBrowse();
            }}
            aria-label={`Select ${props.title.toLowerCase()}`}
          >
            <ImageUp size={20} strokeWidth={1.8} aria-hidden="true" />
            <em>Select image</em>
          </button>
        )}
      </div>
    </section>
  );
}

function getRouteCommandConfig(
  snapshot: WorkspaceState,
  route: NanoRoute,
  actions: {
    onOutputCountChange: (value: number) => void;
    onVariantCountChange: (value: number) => void;
    onVariantIntensityChange: (value: 'jemne' | 'stredne' | 'odvazne') => void;
    onMultiAngleShotCountChange: (value: number) => void;
    onMultiAnglePrecisionChange: (value: 'bezpecna' | 'kreativni') => void;
    onHeadswapHairModeChange: (value: 'source' | 'target' | 'auto') => void;
    onUpscalerScaleChange: (value: '2k' | '4k') => void;
    onUpscalerModeChange: (value: 'creative' | 'precision') => void;
    onModelInfluenceStrengthChange: (value: 'low' | 'medium' | 'high') => void;
    onStyleTransferPreserveCompositionChange: (value: boolean) => void;
    onVisualGuideStepCountChange: (value: number) => void;
    onVisualGuideStyleChange: (value: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial') => void;
    onInfographicFormatChange: (value: 'A4' | 'square' | 'story' | 'wide') => void;
    onInfographicThemeChange: (value: 'light' | 'dark') => void;
  },
) {
  switch (route) {
    case 'mulen':
      return {
        primaryLabel: 'Generate',
        primaryMeta: `${snapshot.photoDirectorOutputCount} vystupu`,
        loadingLabel: 'Generuji...',
        quickActions: [
          { label: 'gen/all models', meta: '', onClick: () => actions.onOutputCountChange(5) },
          { label: 'var/prompts', meta: '', onClick: () => actions.onOutputCountChange(3) },
        ],
        optionRowLabel: 'Image count',
        optionRow: [1, 2, 3, 4, 5].map((value) => ({
          label: String(value),
          active: snapshot.photoDirectorOutputCount === value,
          onClick: () => actions.onOutputCountChange(value),
        })),
        cardTitle: 'Zadani (prompt)',
        primaryModeLabel: 'Simple',
        secondaryModeLabel: 'Interpretace',
      };
    case 'ai-upscaler':
      return {
        primaryLabel: 'Upscale',
        primaryMeta: `${snapshot.aiUpscalerScale.toUpperCase()} · ${snapshot.aiUpscalerMode}`,
        loadingLabel: 'Upscaluji...',
        quickActions: [
          { label: '2K', meta: 'rychle', onClick: () => actions.onUpscalerScaleChange('2k') },
          { label: '4K', meta: 'detail', onClick: () => actions.onUpscalerScaleChange('4k') },
        ],
        optionRowLabel: 'Scale',
        optionRow: [
          { label: '2K', active: snapshot.aiUpscalerScale === '2k', onClick: () => actions.onUpscalerScaleChange('2k') },
          { label: '4K', active: snapshot.aiUpscalerScale === '4k', onClick: () => actions.onUpscalerScaleChange('4k') },
        ],
        cardTitle: 'Upscale nastaveni',
        primaryModeLabel: 'Resolution',
        secondaryModeLabel: 'Detail',
      };
    case 'face-swap':
      return {
        primaryLabel: 'Porovnat',
        primaryMeta: '4 modely',
        loadingLabel: 'Generuji...',
        quickActions: [
          { label: 'Source', meta: headswapStatus(snapshot.headswapSourceAssetId), onClick: () => actions.onHeadswapHairModeChange('source') },
          { label: 'Target', meta: headswapStatus(snapshot.headswapTargetAssetId), onClick: () => actions.onHeadswapHairModeChange('target') },
        ],
        optionRowLabel: 'Vlasy',
        optionRow: [
          { label: 'Source', active: snapshot.headswapHairMode === 'source', onClick: () => actions.onHeadswapHairModeChange('source') },
          { label: 'Target', active: snapshot.headswapHairMode === 'target', onClick: () => actions.onHeadswapHairModeChange('target') },
          { label: 'Auto', active: snapshot.headswapHairMode === 'auto', onClick: () => actions.onHeadswapHairModeChange('auto') },
        ],
        cardTitle: 'Zachovat',
        primaryModeLabel: 'Identity',
        secondaryModeLabel: 'Blend',
      };
    case 'reframe':
      return {
        primaryLabel: 'Camera set',
        primaryMeta: `${snapshot.multiAngleShotCount} zaberu`,
        loadingLabel: 'Generuji...',
        quickActions: [
          { label: 'Safe', meta: 'presne', onClick: () => actions.onMultiAnglePrecisionChange('bezpecna') },
          { label: 'Creative', meta: 'volnejsi', onClick: () => actions.onMultiAnglePrecisionChange('kreativni') },
        ],
        optionRowLabel: 'Pocet zaberu',
        optionRow: [8, 10, 12, 15].map((value) => ({
          label: String(value),
          active: snapshot.multiAngleShotCount === value,
          onClick: () => actions.onMultiAngleShotCountChange(value),
        })),
        cardTitle: 'Plan kamery',
        primaryModeLabel: 'Set',
        secondaryModeLabel: 'Precision',
      };
    case 'variant-lab':
      return {
        primaryLabel: 'Spustit batch',
        primaryMeta: `${snapshot.variantLabCount} variant`,
        loadingLabel: 'Generuji...',
        quickActions: [
          { label: 'Jemne', meta: 'safe', onClick: () => actions.onVariantIntensityChange('jemne') },
          { label: 'Odvazne', meta: 'risk', onClick: () => actions.onVariantIntensityChange('odvazne') },
        ],
        optionRowLabel: 'Pocet variant',
        optionRow: [4, 8, 12, 20].map((value) => ({
          label: String(value),
          active: snapshot.variantLabCount === value,
          onClick: () => actions.onVariantCountChange(value),
        })),
        cardTitle: 'Smer batch promptu',
        primaryModeLabel: 'Variation',
        secondaryModeLabel: 'Intensity',
      };
    case 'visual-guide':
      return {
        primaryLabel: 'Vytvorit navod',
        primaryMeta: `${snapshot.visualGuideStepCount} kroku`,
        loadingLabel: 'Generuji...',
        quickActions: [
          { label: '5 kroku', meta: 'rychle', onClick: () => actions.onVisualGuideStepCountChange(5) },
          { label: '10 kroku', meta: 'detail', onClick: () => actions.onVisualGuideStepCountChange(10) },
        ],
        optionRowLabel: 'Serie',
        optionRow: [5, 8, 10].map((value) => ({
          label: String(value),
          active: snapshot.visualGuideStepCount === value,
          onClick: () => actions.onVisualGuideStepCountChange(value),
        })),
        cardTitle: 'Step planner',
        primaryModeLabel: 'Guide',
        secondaryModeLabel: 'Series',
      };
    case 'infographic':
      return {
        primaryLabel: 'Vytvorit layout',
        primaryMeta: snapshot.infographicFormat,
        loadingLabel: 'Skladam...',
        quickActions: [
          { label: 'A4', meta: 'pdf', onClick: () => actions.onInfographicFormatChange('A4') },
          { label: 'Story', meta: 'social', onClick: () => actions.onInfographicFormatChange('story') },
        ],
        optionRowLabel: 'Format',
        optionRow: [
          { label: 'A4', active: snapshot.infographicFormat === 'A4', onClick: () => actions.onInfographicFormatChange('A4') },
          { label: 'Sqr', active: snapshot.infographicFormat === 'square', onClick: () => actions.onInfographicFormatChange('square') },
          { label: 'Wide', active: snapshot.infographicFormat === 'wide', onClick: () => actions.onInfographicFormatChange('wide') },
        ],
        cardTitle: 'Layout schema',
        primaryModeLabel: 'Outline',
        secondaryModeLabel: 'Render',
      };
  }
}

function headswapStatus(assetId?: string) {
  return assetId ? 'nacteno' : 'chybi';
}

function isRealAsset(asset: Asset | undefined): boolean {
  if (!asset) return false;
  const url = asset.url || '';
  const path = asset.storagePath || '';
  if (url.includes('unsplash.com') || url.includes('images.unsplash')) return false;
  if (path.startsWith('mock/') || path.includes('/mock/')) return false;
  return true;
}

function getRouteUploadConfigs(input: {
  route: NanoRoute;
  originalAsset?: Asset;
  referenceAssets: Asset[];
  lockedCount: number;
  headswapSourceAsset?: Asset;
  headswapTargetAsset?: Asset;
  styleSlotAsset?: Asset;
  brandSlotAsset?: Asset;
}) {
  const realReferenceAssets = input.referenceAssets.filter(isRealAsset);
  const baseStyleHelper = realReferenceAssets[0]?.storagePath ?? 'Stylove reference a look-and-feel';

  switch (input.route) {
    case 'face-swap':
      return [
        {
          id: 'nano-source-face-upload',
          dragKey: 'input' as const,
          mode: 'source-face' as const,
          title: 'Zdrojova hlava',
          count: isRealAsset(input.headswapSourceAsset) ? 1 : 0,
          helper: isRealAsset(input.headswapSourceAsset) ? input.headswapSourceAsset?.storagePath : 'Nahraj source face / head',
          asset: isRealAsset(input.headswapSourceAsset) ? input.headswapSourceAsset : undefined,
        },
        {
          id: 'nano-target-scene-upload',
          dragKey: 'style' as const,
          mode: 'target-scene' as const,
          title: 'Cilovy obrazek',
          count: isRealAsset(input.headswapTargetAsset) ? 1 : 0,
          helper: isRealAsset(input.headswapTargetAsset) ? input.headswapTargetAsset?.storagePath : 'Nahraj target image',
          asset: isRealAsset(input.headswapTargetAsset) ? input.headswapTargetAsset : undefined,
        },
        {
          id: 'nano-headswap-ref-upload',
          dragKey: 'brand' as const,
          mode: 'style' as const,
          title: 'Reference',
          count: realReferenceAssets.length,
          helper: isRealAsset(input.styleSlotAsset) ? input.styleSlotAsset?.storagePath : baseStyleHelper,
          asset: isRealAsset(input.styleSlotAsset) ? input.styleSlotAsset : undefined,
        },
      ];
    case 'reframe':
      return [
        {
          id: 'nano-reframe-source-upload',
          dragKey: 'input' as const,
          mode: 'input' as const,
          title: 'Zdrojovy zaber',
          count: isRealAsset(input.originalAsset) ? 1 : 0,
          helper: isRealAsset(input.originalAsset) ? input.originalAsset?.storagePath : 'Nahraj produkt nebo scenu',
          asset: isRealAsset(input.originalAsset) ? input.originalAsset : undefined,
        },
        {
          id: 'nano-reframe-style-upload',
          dragKey: 'style' as const,
          mode: 'style' as const,
          title: 'Prostredi',
          count: realReferenceAssets.length,
          helper: isRealAsset(input.styleSlotAsset) ? input.styleSlotAsset?.storagePath : baseStyleHelper,
          asset: isRealAsset(input.styleSlotAsset) ? input.styleSlotAsset : undefined,
        },
        {
          id: 'nano-reframe-brand-upload',
          dragKey: 'brand' as const,
          mode: 'brand' as const,
          title: 'Brand prvky',
          count: isRealAsset(input.brandSlotAsset) ? 1 : 0,
          helper: isRealAsset(input.brandSlotAsset) ? input.brandSlotAsset?.storagePath : 'Logo, material, mistnost nebo produkt ktery musi zustat konzistentni.',
          asset: isRealAsset(input.brandSlotAsset) ? input.brandSlotAsset : undefined,
        },
      ];
    default:
      return [
        {
          id: 'nano-input-upload',
          dragKey: 'input' as const,
          mode: 'input' as const,
          title: 'Input images',
          count: isRealAsset(input.originalAsset) ? 1 : 0,
          helper: isRealAsset(input.originalAsset) ? input.originalAsset?.storagePath : 'Nahraj hlavni source fotku',
          asset: isRealAsset(input.originalAsset) ? input.originalAsset : undefined,
        },
        {
          id: 'nano-style-upload',
          dragKey: 'style' as const,
          mode: 'style' as const,
          title: 'Reference images',
          count: realReferenceAssets.length,
          helper: isRealAsset(input.styleSlotAsset) ? input.styleSlotAsset?.storagePath : baseStyleHelper,
          asset: isRealAsset(input.styleSlotAsset) ? input.styleSlotAsset : undefined,
        },
        {
          id: 'nano-brand-upload',
          dragKey: 'brand' as const,
          mode: 'brand' as const,
          title: 'Proprietal images',
          count: isRealAsset(input.brandSlotAsset) ? 1 : 0,
          helper: isRealAsset(input.brandSlotAsset) ? input.brandSlotAsset?.storagePath : 'Logo / produkt. Neovlivnuje styl, pouze obsahove doplneni vystupu.',
          asset: isRealAsset(input.brandSlotAsset) ? input.brandSlotAsset : undefined,
        },
      ];
  }
}

function renderRouteCommandBody(props: {
  route: NanoRoute;
  snapshot: WorkspaceState;
  onInstructionChange: (value: string) => void;
  onLockedTextChange: (value: string) => void;
  onUpscalerScaleChange: (value: '2k' | '4k') => void;
  onUpscalerModeChange: (value: 'creative' | 'precision') => void;
  onUpscalerCreativityChange: (value: number) => void;
  onUpscalerResemblanceChange: (value: number) => void;
  onVariantCountChange: (value: number) => void;
  onVariantIntensityChange: (value: 'jemne' | 'stredne' | 'odvazne') => void;
  onMultiAngleSetTypeChange: (value: 'produktova' | 'interier' | 'lifestyle' | 'social') => void;
  onMultiAngleShotCountChange: (value: number) => void;
  onMultiAnglePrecisionChange: (value: 'bezpecna' | 'kreativni') => void;
  onHeadswapHairModeChange: (value: 'source' | 'target' | 'auto') => void;
  onModelInfluencePromptChange: (value: string) => void;
  onModelInfluenceStrengthChange: (value: 'low' | 'medium' | 'high') => void;
  onStyleTransferPromptChange: (value: string) => void;
  onStyleTransferPreserveCompositionChange: (value: boolean) => void;
  onVisualGuidePromptChange: (value: string) => void;
  onVisualGuideStepCountChange: (value: number) => void;
  onVisualGuideStyleChange: (value: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial') => void;
  onInfographicTopicChange: (value: string) => void;
  onInfographicFormatChange: (value: 'A4' | 'square' | 'story' | 'wide') => void;
  onInfographicThemeChange: (value: 'light' | 'dark') => void;
  promptMode: 'simple' | 'advanced';
}) {
  switch (props.route) {
    case 'mulen':
      return (
        <>
          <div className="nano-prompt-editor">
            {!props.snapshot.photoDirectorInstruction && props.promptMode === 'simple' ? (
              <span className="nano-prompt-editor-icon" aria-hidden="true">
                ✎
              </span>
            ) : null}
            <textarea
              value={props.snapshot.photoDirectorInstruction}
              onChange={(event) => props.onInstructionChange(event.target.value)}
              placeholder={
                props.promptMode === 'advanced'
                  ? 'Popište obrázek přirozeně. Vyberte variantu níže pro určení stylu interpretace...'
                  : ''
              }
            />
          </div>
          <input
            value={props.snapshot.photoDirectorLockedText}
            onChange={(event) => props.onLockedTextChange(event.target.value)}
            placeholder="Co se nesmí změnit"
          />
        </>
      );
    case 'ai-upscaler':
      return (
        <div className="nano-upscaler-controls">
          {/* Creative / Precision — sliding tab selector per Magnific */}
          <div className="nano-upscaler-mode-selector">
            <div className="nano-upscaler-mode-track">
              <div
                className="nano-upscaler-mode-indicator"
                style={{ transform: props.snapshot.aiUpscalerMode === 'precision' ? 'translateX(100%)' : 'translateX(0)' }}
              />
              {(['creative', 'precision'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={props.snapshot.aiUpscalerMode === mode ? 'active' : ''}
                  onClick={() => props.onUpscalerModeChange(mode)}
                >
                  {mode === 'creative' ? 'Creative' : 'Precision'}
                </button>
              ))}
            </div>
          </div>

          {/* Scale — 2K / 4K */}
          <div className="nano-upscaler-row">
            <p>Scale</p>
            <div className="nano-ratio-row">
              {(['2k', '4k'] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={props.snapshot.aiUpscalerScale === scale ? 'active' : ''}
                  onClick={() => props.onUpscalerScaleChange(scale)}
                >
                  {scale.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Creative mode sliders */}
          {props.snapshot.aiUpscalerMode === 'creative' ? (
            <>
              <div className="nano-upscaler-slider-row">
                <div className="nano-upscaler-slider-header">
                  <span>Creativity</span>
                  <span className="nano-upscaler-slider-value">{Math.round(props.snapshot.aiUpscalerCreativity * 100)}</span>
                </div>
                <input
                  type="range"
                  className="nano-upscaler-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={props.snapshot.aiUpscalerCreativity}
                  onChange={(e) => props.onUpscalerCreativityChange(Number(e.target.value))}
                />
                <div className="nano-upscaler-slider-labels">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              <div className="nano-upscaler-slider-row">
                <div className="nano-upscaler-slider-header">
                  <span>Resemblance</span>
                  <span className="nano-upscaler-slider-value">{Math.round(props.snapshot.aiUpscalerResemblance * 100)}</span>
                </div>
                <input
                  type="range"
                  className="nano-upscaler-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={props.snapshot.aiUpscalerResemblance}
                  onChange={(e) => props.onUpscalerResemblanceChange(Number(e.target.value))}
                />
                <div className="nano-upscaler-slider-labels">
                  <span>Faithful</span>
                  <span>Creative</span>
                </div>
              </div>
            </>
          ) : (
            <p className="nano-upscaler-precision-desc">Faithful upscale — preserves the original image exactly, adds only high-frequency detail.</p>
          )}
        </div>
      );
    case 'face-swap':
      return (
        <>
          <input
            value={props.snapshot.photoDirectorLockedText}
            onChange={(event) => props.onLockedTextChange(event.target.value)}
            placeholder="Treba: vyraz, vek, svetlo, tvar obliceje"
          />
          <label>
            Vlasy
            <div className="segmented-control">
              {([
                ['source', 'Source'],
                ['target', 'Target'],
                ['auto', 'Auto'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={props.snapshot.headswapHairMode === value ? 'segment active' : 'segment'}
                  onClick={() => props.onHeadswapHairModeChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
        </>
      );
    case 'reframe':
      return (
        <div className="nano-inline-fields">
          <label>
            Typ sady
            <select
              value={props.snapshot.multiAngleSetType}
              onChange={(event) => props.onMultiAngleSetTypeChange(event.target.value as WorkspaceState['multiAngleSetType'])}
            >
              <option value="produktova">produktova sada</option>
              <option value="interier">interier</option>
              <option value="lifestyle">lifestyle</option>
              <option value="social">social media sada</option>
            </select>
          </label>
          <label>
            Presnost
            <div className="segmented-control two-up">
              {([
                ['bezpecna', 'Bezpecna'],
                ['kreativni', 'Kreativni'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={props.snapshot.multiAnglePrecision === value ? 'segment active' : 'segment'}
                  onClick={() => props.onMultiAnglePrecisionChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
        </div>
      );
    case 'variant-lab':
      return (
        <div className="nano-inline-fields">
          <textarea
            value={props.snapshot.photoDirectorInstruction}
            onChange={(event) => props.onInstructionChange(event.target.value)}
            placeholder="Popis smeru pro batch varianty."
          />
          <label>
            Intenzita
            <div className="segmented-control">
              {([
                ['jemne', 'Jemne'],
                ['stredne', 'Stredne'],
                ['odvazne', 'Odvazne'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={props.snapshot.variantLabIntensity === value ? 'segment active' : 'segment'}
                  onClick={() => props.onVariantIntensityChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
        </div>
      );
    case 'visual-guide':
      return (
        <>
          <textarea
            value={props.snapshot.visualGuidePrompt}
            onChange={(event) => props.onVisualGuidePromptChange(event.target.value)}
            placeholder="Treba: udelej mi navod jak uvarit pho"
          />
          <label>
            Styl
            <div className="segmented-control">
              {([
                ['fotorealisticky', 'Foto'],
                ['edukativni', 'Edu'],
                ['technicky', 'Tech'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={props.snapshot.visualGuideStyle === value ? 'segment active' : 'segment'}
                  onClick={() => props.onVisualGuideStyleChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
        </>
      );
    case 'infographic':
      return (
        <>
          <textarea
            value={props.snapshot.infographicTopic}
            onChange={(event) => props.onInfographicTopicChange(event.target.value)}
            placeholder="Treba: rozdil mezi B2B lead gen a brand kampani"
          />
          <label>
            Tema vzhledu
            <div className="segmented-control two-up">
              <button
                type="button"
                className={props.snapshot.infographicTheme === 'light' ? 'segment active' : 'segment'}
                onClick={() => props.onInfographicThemeChange('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={props.snapshot.infographicTheme === 'dark' ? 'segment active' : 'segment'}
                onClick={() => props.onInfographicThemeChange('dark')}
              >
                Dark
              </button>
            </div>
          </label>
        </>
      );
  }
}

function isPromptEnhanceableRoute(route: NanoRoute) {
  return route === 'mulen' || route === 'variant-lab' || route === 'visual-guide' || route === 'infographic';
}

function NanoRightSidebar(props: {
  activeRoute: NanoRoute;
  promptMode: 'simple' | 'advanced';
  onPromptModeChange: (value: 'simple' | 'advanced') => void;
  simpleLinkMode: 'style' | 'merge' | 'object' | null;
  onSimpleLinkModeChange: (value: 'style' | 'merge' | 'object') => void;
  advancedVariant: 'A' | 'B' | 'C';
  onAdvancedVariantChange: (value: 'A' | 'B' | 'C') => void;
  faceIdentityMode: boolean;
  onFaceIdentityModeChange: (value: boolean) => void;
  selectedModelId?: string;
  onModelSelect?: (modelId: string) => void;
}) {
  const simpleOptions = [
    { id: 'style' as const, label: 'STYL', summary: 'kompozice', description: 'Prenese kompozici, nasviceni a barvy ze stylu. Obsah i identita zustanou ze vstupu.' },
    { id: 'merge' as const, label: 'MERGE', summary: 'spojeni', description: 'Volne spoji vstup a referenci do jednoho vysledku. Meni obsah i formu najednou.' },
    { id: 'object' as const, label: 'OBJECT', summary: 'objekt', description: 'Prenese dominantni objekt nebo prvek z reference do vstupniho obrazu.' },
  ];
  const advancedOptions = [
    { id: 'A' as const, label: 'VARIANTA A', summary: 'Autenticita', description: 'Maximalni autenticita a verohodnost. Drzi realitu a prirozene nedokonalosti.' },
    { id: 'B' as const, label: 'VARIANTA B', summary: 'Vylepseni', description: 'Silnejsi esteticke vylepseni. Cistsi, vybrusenejsi a vice premium vysledek.' },
    { id: 'C' as const, label: 'VARIANTA C', summary: 'Vybalancovane', description: 'Vyrovnany kompromis mezi realitou a estetikou. Bezpecna vychozi volba.' },
  ];
  return (
    <aside className="nano-right-panel">
      {props.activeRoute === 'mulen' ? (
        <div className="nano-route-panel">
          <section className="nano-prompt-mode-block">
            <h3 className="section-heading">Režimy promptu</h3>
            {props.promptMode === 'simple' ? (
              <div className="nano-prompt-mode-grid">
                {simpleOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={props.simpleLinkMode === option.id ? 'nano-prompt-mode-option active' : 'nano-prompt-mode-option'}
                    onClick={() => props.onSimpleLinkModeChange(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span className="nano-option-summary">{option.summary}</span>
                    <p>{option.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="nano-prompt-mode-description">
                Interpretace běží z levého prompt pole. Varianta A, B, C i zachování identity tváře jsou pod promptem stejně jako v Nano.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  );
}

export function ProjectWorkspace(props: {
  snapshot: WorkspaceSnapshot;
  activeRoute: NanoRoute;
  theme: 'light' | 'dark';
  apiConfig?: ApiConfig | null;
  loadingError?: string | null;
}) {
  const { snapshot } = props;
  const [workspace, setWorkspace] = useState(() => createWorkspaceState(snapshot));
  const [isGenerating, setIsGenerating] = useState(false);
  const [workspaceNote, setWorkspaceNote] = useState('Pokracuj z aktivni verze a branchuj dalsi smery bez ztraty historie.');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [promptMode, setPromptMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleLinkMode, setSimpleLinkMode] = useState<'style' | 'merge' | 'object' | null>(null);
  const [advancedVariant, setAdvancedVariant] = useState<'A' | 'B' | 'C'>('C');
  const [faceIdentityMode, setFaceIdentityMode] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [isSavedPromptsOpen, setIsSavedPromptsOpen] = useState(false);
  const [isSavePromptOpen, setIsSavePromptOpen] = useState(false);
  const [savedPromptDraftName, setSavedPromptDraftName] = useState('');
  const [selectedSavedPromptId, setSelectedSavedPromptId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-flash');
  const [imageModelPresets, setImageModelPresets] = useState<ImageModelPreset[]>(FALLBACK_IMAGE_MODEL_PRESETS);
  const [semanticReferencePrompt, setSemanticReferencePrompt] = useState('');
  const [semanticMixSelection, setSemanticMixSelection] = useState<Record<keyof PromptCategories, boolean>>(DEFAULT_SEMANTIC_MIX);
  const [semanticPromptVariants, setSemanticPromptVariants] = useState<Array<{ variant: string; approach: string; prompt: string }>>([]);
  const [isGeneratingPromptVariants, setIsGeneratingPromptVariants] = useState(false);
  const [isSemanticRemixing, setIsSemanticRemixing] = useState(false);
  const deletedVersionIdsRef = useRef<Set<string>>(new Set());
  const deletedJobIdsRef = useRef<Set<string>>(new Set());
  const promptHistoryRef = useRef<Record<NanoRoute, PromptHistory>>({
    mulen: new PromptHistory(),
    'ai-upscaler': new PromptHistory(),
    'face-swap': new PromptHistory(),
    reframe: new PromptHistory(),
    'variant-lab': new PromptHistory(),
    'visual-guide': new PromptHistory(),
    infographic: new PromptHistory(),
  });

  const canGenerate = useMemo(() => {
    switch (props.activeRoute) {
      case 'mulen':
        return workspace.photoDirectorInstruction.trim() !== '';
      case 'ai-upscaler':
        return !!workspace.project.originalAssetId;
      case 'face-swap':
        return !!workspace.headswapSourceAssetId && !!workspace.headswapTargetAssetId;
      case 'reframe':
        return !!workspace.project.originalAssetId;
      case 'variant-lab':
        return workspace.photoDirectorInstruction.trim() !== '' || !!workspace.project.originalAssetId;
      case 'visual-guide':
        return workspace.visualGuidePrompt?.trim() !== '';
      case 'infographic':
        return workspace.infographicTopic?.trim() !== '';
      default:
        return true;
    }
  }, [props.activeRoute, workspace, snapshot.assets]);

  const getPromptHistory = (route: NanoRoute) => promptHistoryRef.current[route];

  const getCurrentHistoryPrompt = (route: NanoRoute) => {
    const history = getPromptHistory(route);
    const currentId = history.getCurrentEntryId();
    if (!currentId) return '';
    const currentEntry = history.getEntries().find((entry) => entry.id === currentId);
    return currentEntry?.prompt ?? '';
  };

  const applyPromptHistoryToWorkspace = (state: WorkspaceState): WorkspaceState => ({
    ...state,
    photoDirectorInstruction: getCurrentHistoryPrompt('mulen') || state.photoDirectorInstruction,
    visualGuidePrompt: getCurrentHistoryPrompt('visual-guide') || state.visualGuidePrompt,
    infographicTopic: getCurrentHistoryPrompt('infographic') || state.infographicTopic,
  });

  const persistPromptHistories = () => {
    if (typeof window === 'undefined') return;
    const snapshot = Object.fromEntries(
      (Object.keys(promptHistoryRef.current) as NanoRoute[]).map((route) => [route, promptHistoryRef.current[route].serialize()]),
    );
    window.localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(snapshot));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Record<NanoRoute, ReturnType<PromptHistory['serialize']>>>) : null;
      if (!parsed) return;
      (Object.keys(promptHistoryRef.current) as NanoRoute[]).forEach((route) => {
        promptHistoryRef.current[route].restore(parsed[route]);
      });
    } catch {
      // Keep UI usable even if prompt history storage is corrupted.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await api.getProviderCatalog();
        if (cancelled) return;
        const nextPresets = mapProviderCatalogToModelPresets(response.providers);
        if (nextPresets.length) {
          setImageModelPresets(nextPresets);
          const savedModelId =
            typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_IMAGE_MODEL_STORAGE_KEY) : null;
          const nextModel = nextPresets.find((preset) => preset.id === savedModelId)?.id ?? nextPresets[0].id;
          setSelectedModelId(nextModel);
        }
      } catch {
        if (typeof window === 'undefined' || cancelled) return;
        const savedModelId = window.localStorage.getItem(SELECTED_IMAGE_MODEL_STORAGE_KEY);
        const nextModel = FALLBACK_IMAGE_MODEL_PRESETS.find((preset) => preset.id === savedModelId)?.id ?? FALLBACK_IMAGE_MODEL_PRESETS[0].id;
        setSelectedModelId(nextModel);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const syncWorkspaceFromApi = async () => {
    const nextSnapshot = filterDeletedEntities(
      await api.getProject(workspace.project.id),
      deletedVersionIdsRef.current,
      deletedJobIdsRef.current,
    );
    startTransition(() => {
      setWorkspace((current) => {
        const next = applyPromptHistoryToWorkspace(createWorkspaceState(nextSnapshot));
        next.headswapSourceAssetId = current.headswapSourceAssetId;
        next.headswapTargetAssetId = current.headswapTargetAssetId ?? next.headswapTargetAssetId;
        next.headswapHairMode = current.headswapHairMode;
        next.headswapNotes = current.headswapNotes;
        return next;
      });
    });
    return nextSnapshot;
  };

  const runBackendJob = async (input: {
    module: 'photo-director' | 'variant-lab' | 'multi-angle-reframe' | 'headswap' | 'visual-guide' | 'infographic-generator';
    jobInput: Record<string, unknown>;
    startMessage: string;
    progressLabel: string;
    successMessage: (snapshot: WorkspaceSnapshot) => string;
  }) => {
    setIsGenerating(true);
    setWorkspaceNote(input.startMessage);

    try {
      const job = await api.createJob({
        projectId: workspace.project.id,
        module: input.module,
        input: input.jobInput,
      });

      const finalJob = await waitForJob(job.id, (progressJob) => {
        setWorkspaceNote(`${input.progressLabel}: ${progressJob.progress}%`);
      });

      const nextSnapshot = await syncWorkspaceFromApi();
      setWorkspaceNote(
        finalJob.status === 'succeeded'
          ? input.successMessage(nextSnapshot)
          : `Job pro ${input.progressLabel.toLowerCase()} skoncil ve stavu ${finalJob.status}.`,
      );
      return nextSnapshot;
    } catch (error) {
      setWorkspaceNote(error instanceof Error ? error.message : 'Backend job selhal.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      setWorkspace(
        applyPromptHistoryToWorkspace(
          createWorkspaceState(filterDeletedEntities(snapshot, deletedVersionIdsRef.current, deletedJobIdsRef.current)),
        ),
      );
    });
  }, [snapshot]);

  useEffect(() => {
    if (props.loadingError) {
      setWorkspaceNote(`Backend neni dostupny, appka jede v lokalnim fallbacku. ${props.loadingError}`);
      return;
    }

    if (props.apiConfig?.mode === 'mock') {
      setWorkspaceNote('Mulen jede na mock backend workflow. Upload, job system i export uz jedou pres API napric hlavnim moduly.');
    }
  }, [props.apiConfig, props.loadingError]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await api.getSavedPrompts();
        let normalized = response.prompts.map(normalizeSavedPromptRecord);

        if (!normalized.length && typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem(SAVED_PROMPTS_STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as Array<Partial<SavedPrompt> & { prompt?: string }>) : [];
            const legacy = Array.isArray(parsed)
              ? parsed
                  .filter((item) => item && typeof item.id === 'string' && (typeof item.text === 'string' || typeof item.prompt === 'string'))
                  .map(normalizeLegacySavedPromptRecord)
              : [];
            if (legacy.length) {
              await Promise.all(
                legacy.map((prompt) =>
                  api.saveSavedPrompt({
                    id: prompt.id,
                    name: prompt.name,
                    prompt: prompt.text,
                    category: prompt.category,
                  }),
                ),
              );
              normalized = legacy;
            }
          } catch {
            // Ignore legacy migration failures and keep UI running.
          }
        }

        if (cancelled) return;
        setSavedPrompts(normalized);
        setSelectedSavedPromptId(normalized[0]?.id ?? null);
      } catch {
        if (typeof window === 'undefined' || cancelled) return;
        try {
          const raw = window.localStorage.getItem(SAVED_PROMPTS_STORAGE_KEY);
          const parsed = raw ? (JSON.parse(raw) as Array<Partial<SavedPrompt> & { prompt?: string }>) : [];
          const normalized = Array.isArray(parsed)
            ? parsed
                .filter((item) => item && typeof item.id === 'string' && (typeof item.text === 'string' || typeof item.prompt === 'string'))
                .map(normalizeLegacySavedPromptRecord)
            : [];
          setSavedPrompts(normalized);
          setSelectedSavedPromptId(normalized[0]?.id ?? null);
        } catch {
          // Keep UI usable even if local storage contains invalid data.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SELECTED_IMAGE_MODEL_STORAGE_KEY, selectedModelId);
    setModel(selectedModelId).catch(console.error);
  }, [selectedModelId]);

  useEffect(() => {
    const currentPrompt = getPromptValueForRoute(props.activeRoute, workspace).trim();
    if (!currentPrompt) return;
    const history = getPromptHistory(props.activeRoute);
    if (!history.hasEntries()) {
      history.add(currentPrompt);
      persistPromptHistories();
    }
  }, [props.activeRoute, workspace.photoDirectorInstruction, workspace.visualGuidePrompt, workspace.infographicTopic]);

  const setActiveVersion = (versionId: string) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        project: {
          ...current.project,
          activeVersionId: versionId,
        },
      }));
    });
  };

  const setInstruction = (value: string) => {
    setEnhanceError(null);
    setPromptValueForRoute('mulen', value);
  };

  const setLockedText = (value: string) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        photoDirectorLockedText: value,
      }));
    });
  };

  const persistSavedPrompts = (nextPrompts: SavedPrompt[]) => {
    setSavedPrompts(nextPrompts);
    setSelectedSavedPromptId(nextPrompts[0]?.id ?? null);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SAVED_PROMPTS_STORAGE_KEY, JSON.stringify(nextPrompts));
    }
  };

  const getPromptValueForRoute = (route: NanoRoute, current: WorkspaceState) => {
    switch (route) {
      case 'mulen':
      case 'variant-lab':
        return current.photoDirectorInstruction;
      case 'visual-guide':
        return current.visualGuidePrompt;
      case 'infographic':
        return current.infographicTopic;
      default:
        return '';
    }
  };

  const activePromptHistory = getPromptHistory(props.activeRoute);
  const currentPromptValue = getPromptValueForRoute(props.activeRoute, workspace);
  const promptHistoryEntries = [...activePromptHistory.getEntries()].reverse();
  const currentPromptHistoryEntryId = activePromptHistory.getCurrentEntryId();

  const setPromptValueForRoute = (route: NanoRoute, value: string, options?: { addToHistory?: boolean }) => {
    if (options?.addToHistory !== false) {
      getPromptHistory(route).add(value);
      persistPromptHistories();
    }
    startTransition(() => {
      setWorkspace((current) => {
        switch (route) {
          case 'mulen':
          case 'variant-lab':
            return { ...current, photoDirectorInstruction: value };
          case 'visual-guide':
            return { ...current, visualGuidePrompt: value };
          case 'infographic':
            return { ...current, infographicTopic: value };
          default:
            return current;
        }
      });
    });
  };

  const handleEnhancePrompt = async () => {
    const route = props.activeRoute;
    if (!isPromptEnhanceableRoute(route)) return;
    const currentPrompt = getPromptValueForRoute(route, workspace);
    if (!currentPrompt.trim()) {
      setEnhanceError('Nejdriv napis prompt.');
      return;
    }

    setIsEnhancing(true);
    setEnhanceError(null);

    try {
      const response = await api.enhancePrompt({ prompt: currentPrompt });
      setPromptValueForRoute(route, response.prompt);
    } catch (error) {
      setEnhanceError(error instanceof Error ? 'Prompt se nepodarilo vylepsit.' : 'Prompt se nepodarilo vylepsit.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUndoPromptEnhance = () => {
    const previous = getPromptHistory(props.activeRoute).undo();
    if (!previous) return;
    persistPromptHistories();
    setPromptValueForRoute(props.activeRoute, previous, { addToHistory: false });
    setEnhanceError(null);
  };

  const handleRedoPromptHistory = () => {
    const next = getPromptHistory(props.activeRoute).redo();
    if (!next) return;
    persistPromptHistories();
    setPromptValueForRoute(props.activeRoute, next, { addToHistory: false });
    setEnhanceError(null);
  };

  const handleSelectPromptHistoryEntry = (entryId: string) => {
    const selected = getPromptHistory(props.activeRoute).jumpTo(entryId);
    if (!selected) return;
    persistPromptHistories();
    setPromptValueForRoute(props.activeRoute, selected, { addToHistory: false });
    setEnhanceError(null);
  };

  const handleOpenSavePrompt = () => {
    const text = getPromptValueForRoute(props.activeRoute, workspace).trim();
    if (!text) {
      setEnhanceError('Nejdriv napis prompt.');
      return;
    }
    setSavedPromptDraftName(text.slice(0, 48).trim());
    setIsSavePromptOpen(true);
    setIsSavedPromptsOpen(false);
    setEnhanceError(null);
  };

  const handleSavePrompt = async () => {
    const text = getPromptValueForRoute(props.activeRoute, workspace).trim();
    const name = savedPromptDraftName.trim();
    if (!text || !name) {
      setEnhanceError('Prompt i nazev musi byt vyplnene.');
      return;
    }
    try {
      const response = await api.saveSavedPrompt({
        name,
        prompt: text,
      });
      const nextPrompt = normalizeSavedPromptRecord(response.prompt);
      persistSavedPrompts([nextPrompt, ...savedPrompts.filter((prompt) => prompt.id !== nextPrompt.id)]);
      setEnhanceError(null);
      setIsSavedPromptsOpen(false);
      setIsSavePromptOpen(false);
      setSavedPromptDraftName('');
    } catch {
      setEnhanceError('Prompt se nepodařilo uložit.');
    }
  };

  const handleLoadPrompt = (text: string) => {
    setPromptValueForRoute(props.activeRoute, text);
    setIsSavedPromptsOpen(false);
    setIsSavePromptOpen(false);
    setEnhanceError(null);
  };

  const handleSelectSavedPrompt = (id: string) => {
    setSelectedSavedPromptId(id);
  };

  const handleDeletePrompt = (id: string) => {
    persistSavedPrompts(savedPrompts.filter((prompt) => prompt.id !== id));
    void api.deleteSavedPrompt(id);
  };

  const handleGeneratePromptVariants = async () => {
    const currentPrompt = getPromptValueForRoute(props.activeRoute, workspace).trim();
    if (!currentPrompt) {
      setEnhanceError('Nejdřív napiš prompt.');
      return;
    }

    setIsGeneratingPromptVariants(true);
    setEnhanceError(null);

    try {
      const response = await api.generatePromptVariants({ prompt: currentPrompt });
      setSemanticPromptVariants(response.variants);
    } catch {
      setEnhanceError('Varianty promptu se nepodařilo vygenerovat.');
    } finally {
      setIsGeneratingPromptVariants(false);
    }
  };

  const handleToggleSemanticMixCategory = (key: keyof PromptCategories) => {
    setSemanticMixSelection((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleRunSemanticPromptRemix = async () => {
    const promptA = getPromptValueForRoute(props.activeRoute, workspace).trim();
    const promptB = semanticReferencePrompt.trim();
    if (!promptA || !promptB) {
      setEnhanceError('Vyplň hlavní i referenční prompt.');
      return;
    }

    const mix = Object.entries(semanticMixSelection).reduce<Record<string, 'A' | 'B'>>((acc, [key, value]) => {
      acc[key] = value ? 'B' : 'A';
      return acc;
    }, {});

    setIsSemanticRemixing(true);
    setEnhanceError(null);

    try {
      const response = await api.remixPrompt({ promptA, promptB, mix });
      setPromptValueForRoute(props.activeRoute, response.prompt);
    } catch {
      setEnhanceError('Semantic remix se nepodařilo vytvořit.');
    } finally {
      setIsSemanticRemixing(false);
    }
  };

  const setVariantCount = (value: number) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        variantLabCount: value,
      }));
    });
  };

  const setVariantIntensity = (value: 'jemne' | 'stredne' | 'odvazne') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        variantLabIntensity: value,
      }));
    });
  };

  const setMultiAngleSetType = (value: 'produktova' | 'interier' | 'lifestyle' | 'social') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        multiAngleSetType: value,
      }));
    });
  };

  const setMultiAngleShotCount = (value: number) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        multiAngleShotCount: value,
      }));
    });
  };

  const setMultiAnglePrecision = (value: 'bezpecna' | 'kreativni') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        multiAnglePrecision: value,
      }));
    });
  };

  const setHeadswapHairMode = (value: 'source' | 'target' | 'auto') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        headswapHairMode: value,
      }));
    });
  };

  const setHeadswapNote = (versionId: string, value: string) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        headswapNotes: {
          ...current.headswapNotes,
          [versionId]: value,
        },
      }));
    });
  };

  const setVisualGuidePrompt = (value: string) => {
    setEnhanceError(null);
    setPromptValueForRoute('visual-guide', value);
  };

  const setVisualGuideStepCount = (value: number) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        visualGuideStepCount: value,
      }));
    });
  };

  const setVisualGuideStyle = (value: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        visualGuideStyle: value,
      }));
    });
  };

  const setVisualGuideOutput = (value: 'carousel' | 'pdf' | 'blog' | 'web') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        visualGuideOutput: value,
      }));
    });
  };

  const setInfographicTopic = (value: string) => {
    setEnhanceError(null);
    setPromptValueForRoute('infographic', value);
  };

  const setInfographicType = (value: 'edukacni' | 'srovnavaci' | 'procesni' | 'business') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        infographicType: value,
      }));
    });
  };

  const setInfographicFormat = (value: 'A4' | 'square' | 'story' | 'wide') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        infographicFormat: value,
      }));
    });
  };

  const setInfographicTheme = (value: 'light' | 'dark') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        infographicTheme: value,
      }));
    });
  };

  const setExportFormat = (value: 'png' | 'jpg' | 'pdf' | 'html') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        exportFormat: value,
      }));
    });
  };

  const setExportUseCase = (value: 'web' | 'social' | 'print' | 'archive') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        exportUseCase: value,
      }));
    });
  };

  const setUpscalerScale = (value: '2k' | '4k') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        aiUpscalerScale: value,
      }));
    });
  };

  const setUpscalerMode = (value: 'creative' | 'precision') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        aiUpscalerMode: value,
      }));
    });
  };

  const setUpscalerCreativity = (value: number) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        aiUpscalerCreativity: value,
      }));
    });
  };

  const setUpscalerResemblance = (value: number) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        aiUpscalerResemblance: value,
      }));
    });
  };

  const setModelInfluencePrompt = (value: string) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        modelInfluencePrompt: value,
      }));
    });
  };

  const setModelInfluenceStrength = (value: 'low' | 'medium' | 'high') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        modelInfluenceStrength: value,
      }));
    });
  };

  const setStyleTransferPrompt = (value: string) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        styleTransferPrompt: value,
      }));
    });
  };

  const setStyleTransferPreserveComposition = (value: boolean) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        styleTransferPreserveComposition: value,
      }));
    });
  };

  const setOutputCount = (value: number) => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        photoDirectorOutputCount: value,
      }));
    });
  };

  const setPolishMode = (value: 'focused' | 'balanced' | 'bold') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        photoDirectorPolishMode: value,
      }));
    });
  };

  const handleUploadImage = async (file: File) => {
    if (props.apiConfig?.features.inlineUpload) {
      try {
        setWorkspaceNote(`Nahravam ${file.name} do projektove pameti...`);
        const dataUrl = await fileToDataUrl(file);
        const response = await api.inlineUpload({
          projectId: workspace.project.id,
          kind: 'original',
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          dataUrl,
        });

        startTransition(() => {
          setWorkspace(createWorkspaceState(response.snapshot));
        });
        setWorkspaceNote(`Nova vstupni fotka ${file.name} se stala novym vychozim bodem projektu.`);
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Upload vstupni fotky selhal.');
      }
      return;
    }

    const fileUrl = URL.createObjectURL(file);
    const createdAt = new Date().toISOString();
    setWorkspaceNote(`Nova vstupni fotka ${file.name} se stala novym vychozim bodem projektu.`);

    startTransition(() => {
      setWorkspace((current) => {
        const assetId = `asset-upload-${Date.now()}`;
        const versionId = `version-upload-${Date.now()}`;
        const originalVersion = current.versions.find((version) => version.id === 'version-original');

        const nextAsset: Asset = {
          id: assetId,
          projectId: current.project.id,
          userId: current.project.userId,
          kind: 'original',
          url: fileUrl,
          storagePath: `mock/uploads/${file.name}`,
          mimeType: file.type || 'image/jpeg',
          createdAt,
        };

        const nextVersion: ImageVersion = {
          id: versionId,
          projectId: current.project.id,
          assetId,
          label: 'Uploaded original',
          module: 'photo-director',
          createdAt,
          qualityScore: originalVersion?.qualityScore ?? 70,
        };

        return {
          ...current,
          assets: [nextAsset, ...current.assets.filter((asset) => asset.id !== current.project.originalAssetId)],
          versions: [nextVersion, ...current.versions.filter((version) => version.id !== 'version-original')],
          project: {
            ...current.project,
            originalAssetId: assetId,
            activeVersionId: versionId,
            updatedAt: createdAt,
          },
          visualCanon: {
            ...current.visualCanon,
            referenceAssetIds: [assetId],
            updatedAt: createdAt,
          },
        };
      });
    });
  };

  const uploadReferenceAssetToWorkspace = async (file: File, slot: 'style' | 'brand' = 'style') => {
    if (props.apiConfig?.features.inlineUpload) {
      try {
        setWorkspaceNote(`Pridavam referenci ${file.name} do Visual Canon...`);
        const dataUrl = await fileToDataUrl(file);
        const response = await api.inlineUpload({
          projectId: workspace.project.id,
          kind: 'reference',
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          dataUrl,
        });

        startTransition(() => {
          const next = createWorkspaceState(response.snapshot);
          if (slot === 'style') next.styleSlotAssetId = response.asset.id;
          if (slot === 'brand') next.brandSlotAssetId = response.asset.id;
          setWorkspace(next);
        });
        setWorkspaceNote(`Reference ${file.name} byla pridana do Visual Canon jako dalsi voditko pro konzistenci.`);
        return response.asset;
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Upload reference selhal.');
        return null;
      }
      
    }

    const fileUrl = URL.createObjectURL(file);
    const createdAt = new Date().toISOString();
    setWorkspaceNote(`Reference ${file.name} byla pridana do Visual Canon jako dalsi voditko pro konzistenci.`);

    const assetId = `asset-reference-${Date.now()}`;
    const nextAsset: Asset = {
      id: assetId,
      projectId: workspace.project.id,
      userId: workspace.project.userId,
      kind: 'reference',
      url: fileUrl,
      storagePath: `mock/references/${file.name}`,
      mimeType: file.type || 'image/jpeg',
      createdAt,
    };

    startTransition(() => {
      setWorkspace((current) => {
        return {
          ...current,
          assets: [nextAsset, ...current.assets],
          styleSlotAssetId: slot === 'style' ? nextAsset.id : current.styleSlotAssetId,
          brandSlotAssetId: slot === 'brand' ? nextAsset.id : current.brandSlotAssetId,
          visualCanon: {
            ...current.visualCanon,
            referenceAssetIds: [current.project.originalAssetId, nextAsset.id].filter(Boolean) as string[],
            updatedAt: createdAt,
          },
        };
      });
    });
    return nextAsset;
  };

  const handleUploadReference = async (file: File, slot: 'style' | 'brand' = 'style') => {
    await uploadReferenceAssetToWorkspace(file, slot);
  };

  const handleSelectExistingAsset = (asset: Asset, slot: 'input' | 'style' | 'brand' | 'source-face' | 'target-scene') => {
    const createdAt = new Date().toISOString();

    startTransition(() => {
      setWorkspace((current) => {
        const isLibraryPlaceholder = asset.projectId === 'library' || asset.metadata?.placeholder === true;
        const selectedAsset: Asset =
          isLibraryPlaceholder
            ? {
                ...asset,
                id: `asset-library-${slot}-${Date.now()}`,
                projectId: current.project.id,
                userId: current.project.userId,
                kind: slot === 'input' || slot === 'target-scene' ? 'original' : 'reference',
                createdAt,
                metadata: {
                  ...asset.metadata,
                  importedFromLibrary: true,
                  sourceAssetId: asset.id,
                },
              }
            : asset;
        const assets =
          current.assets.some((existingAsset) => existingAsset.id === selectedAsset.id)
            ? current.assets
            : [selectedAsset, ...current.assets];

        switch (slot) {
          case 'input': {
            const matchingVersion = current.versions.find((version) => version.assetId === selectedAsset.id);
            return {
              ...current,
              assets,
              project: {
                ...current.project,
                originalAssetId: selectedAsset.id,
                activeVersionId: matchingVersion?.id ?? current.project.activeVersionId,
                updatedAt: createdAt,
              },
            };
          }
          case 'style':
            return {
              ...current,
              assets,
              styleSlotAssetId: selectedAsset.id,
              visualCanon: {
                ...current.visualCanon,
                referenceAssetIds: Array.from(new Set([selectedAsset.id, ...current.visualCanon.referenceAssetIds])),
                updatedAt: createdAt,
              },
            };
          case 'brand':
            return {
              ...current,
              assets,
              brandSlotAssetId: selectedAsset.id,
              visualCanon: {
                ...current.visualCanon,
                referenceAssetIds: Array.from(new Set([selectedAsset.id, ...current.visualCanon.referenceAssetIds])),
                updatedAt: createdAt,
              },
            };
          case 'source-face':
            return {
              ...current,
              assets,
              headswapSourceAssetId: selectedAsset.id,
            };
          case 'target-scene':
            return {
              ...current,
              assets,
              headswapTargetAssetId: selectedAsset.id,
            };
        }
      });
    });

    const labels = {
      input: 'Vstupni slot ted pouziva vybrany obrazek z knihovny.',
      style: 'Stylovy slot ted odkazuje na vybrany obrazek z knihovny.',
      brand: 'Proprietarni slot ted odkazuje na vybrany obrazek z knihovny.',
      'source-face': 'Source identita byla vybrana z knihovny.',
      'target-scene': 'Target scena byla vybrana z knihovny.',
    } as const;

    setWorkspaceNote(labels[slot]);
  };

  const handleUseVersionAsInput = (versionId: string) => {
    const selectedVersion = workspace.versions.find((version) => version.id === versionId);
    const selectedAsset = selectedVersion ? workspace.assets.find((asset) => asset.id === selectedVersion.assetId) : null;
    if (!selectedVersion || !selectedAsset) return;

    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        project: {
          ...current.project,
          originalAssetId: selectedAsset.id,
          activeVersionId: selectedVersion.id,
          updatedAt: new Date().toISOString(),
        },
      }));
    });

    setWorkspaceNote('Vybraný obrázek je teď nastavený jako nový vstup v Input images.');
  };

  const handleHeadswapSourceUpload = async (file: File) => {
    if (props.apiConfig?.features.inlineUpload) {
      try {
        setWorkspaceNote(`Nahravam source identitu ${file.name} do projektove pameti...`);
        const dataUrl = await fileToDataUrl(file);
        const response = await api.inlineUpload({
          projectId: workspace.project.id,
          kind: 'reference',
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          dataUrl,
        });

        startTransition(() => {
          const next = createWorkspaceState(response.snapshot);
          next.headswapSourceAssetId = response.asset.id;
          next.headswapTargetAssetId = workspace.headswapTargetAssetId ?? next.headswapTargetAssetId;
          next.headswapHairMode = workspace.headswapHairMode;
          setWorkspace(next);
        });
        setWorkspaceNote(`Zdrojova identita ${file.name} je pripravena pro porovnani headswap vysledku.`);
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Upload source identity selhal.');
      }
      return;
    }

    const fileUrl = URL.createObjectURL(file);
    const createdAt = new Date().toISOString();
    setWorkspaceNote(`Zdrojova identita ${file.name} je pripravena pro porovnani headswap vysledku.`);

    startTransition(() => {
      setWorkspace((current) => {
        const assetId = `asset-headswap-source-${Date.now()}`;
        const asset: Asset = {
          id: assetId,
          projectId: current.project.id,
          userId: current.project.userId,
          kind: 'reference',
          url: fileUrl,
          storagePath: `mock/headswap/${file.name}`,
          mimeType: file.type || 'image/jpeg',
          createdAt,
        };

        return {
          ...current,
          assets: [asset, ...current.assets],
          headswapSourceAssetId: assetId,
        };
      });
    });
  };

  const handleHeadswapTargetUpload = async (file: File) => {
    if (props.apiConfig?.features.inlineUpload) {
      try {
        setWorkspaceNote(`Nahravam target obrazek ${file.name} do projektove pameti...`);
        const dataUrl = await fileToDataUrl(file);
        const response = await api.inlineUpload({
          projectId: workspace.project.id,
          kind: 'reference',
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          dataUrl,
        });

        startTransition(() => {
          const next = createWorkspaceState(response.snapshot);
          next.headswapTargetAssetId = response.asset.id;
          next.headswapSourceAssetId = workspace.headswapSourceAssetId;
          next.headswapHairMode = workspace.headswapHairMode;
          setWorkspace(next);
        });
        setWorkspaceNote(`Cilovy obrazek ${file.name} je pripraveny jako scena pro headswap.`);
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Upload target image selhal.');
      }
      return;
    }

    const fileUrl = URL.createObjectURL(file);
    const createdAt = new Date().toISOString();
    setWorkspaceNote(`Cilovy obrazek ${file.name} je pripraveny jako scena pro headswap.`);

    startTransition(() => {
      setWorkspace((current) => {
        const assetId = `asset-headswap-target-${Date.now()}`;
        const asset: Asset = {
          id: assetId,
          projectId: current.project.id,
          userId: current.project.userId,
          kind: 'reference',
          url: fileUrl,
          storagePath: `mock/headswap/${file.name}`,
          mimeType: file.type || 'image/jpeg',
          createdAt,
        };

        return {
          ...current,
          assets: [asset, ...current.assets],
          headswapTargetAssetId: assetId,
        };
      });
    });
  };

  const handleGenerate = async () => {
    if (props.activeRoute === 'mulen' && props.apiConfig?.features.photoDirector) {
      const originalAsset = workspace.assets.find((asset) => asset.id === workspace.project.originalAssetId);
      const useSourceImage = Boolean(originalAsset && !isMockLikeAsset(originalAsset));
      const useReferenceImages = workspace.visualCanon.referenceAssetIds
        .map((assetId) => workspace.assets.find((asset) => asset.id === assetId))
        .some((asset) => asset?.kind === 'reference' && !isMockLikeAsset(asset));
      const nextAspectRatio = resolvePhotoDirectorAspectRatio(useSourceImage);

      setIsGenerating(true);
      setWorkspaceNote('Photo Director odesila zadani do backend job systemu a ceka na novou verzi.');

      try {
        const job = await api.createPhotoDirectorJob({
          projectId: workspace.project.id,
          instruction: workspace.photoDirectorInstruction,
          lockedText: workspace.photoDirectorLockedText,
          outputCount: workspace.photoDirectorOutputCount,
          aspectRatio: nextAspectRatio,
          polishMode: workspace.photoDirectorPolishMode,
          promptMode,
          simpleLinkMode,
          advancedVariant,
          faceIdentityMode,
          sourceVersionId: useSourceImage ? workspace.project.activeVersionId : undefined,
          useSourceImage,
          useReferenceImages,
          modelId: selectedModelId,
        });

        const finalJob = await waitForJob(job.id, (progressJob) => {
          setWorkspaceNote(`Photo Director bezi: ${progressJob.progress}%`);
        });

        const nextSnapshot = await syncWorkspaceFromApi();
        const activeVersion = nextSnapshot.versions.find((version) => version.id === nextSnapshot.project.activeVersionId);
        setWorkspaceNote(
          finalJob.status === 'succeeded'
            ? `Nova editace ${activeVersion?.label ?? 'je hotova'} byla ulozena do project memory.`
            : 'Job skoncil, ale backend vratil neplny nebo chybovy stav.',
        );
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Generovani se nepodarilo dokoncit.');
      } finally {
        setIsGenerating(false);
      }

      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Photo Director pripravuje dalsi editace z aktivni verze a drzi zamcene oblasti.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const variantIndex = current.versions.filter((version) => version.module === 'photo-director').length;
          const nextAspectRatio = resolvePhotoDirectorAspectRatio(Boolean(current.project.originalAssetId));
          const jobId = `job-generated-${Date.now()}`;
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const steps: EditStep[] = [];
          const runs: ModelRun[] = [];
          const qaList: QualityEvaluation[] = [];
          const outputVersionIds: string[] = [];
          const count = current.photoDirectorOutputCount;

          for (let index = 0; index < count; index += 1) {
            const assetId = `asset-generated-${Date.now()}-${index}`;
            const versionId = `version-generated-${Date.now()}-${index}`;
            const stepId = `step-generated-${Date.now()}-${index}`;
            const runId = `run-generated-${Date.now()}-${index}`;
            const qualityId = `qa-generated-${Date.now()}-${index}`;
            const nextImageUrl = MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length];

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: nextImageUrl,
              storagePath: `mock/generated/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
              metadata: {
                aspectRatio: nextAspectRatio,
                polishMode: current.photoDirectorPolishMode,
              },
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: activeVersion?.id,
              assetId,
              label: count === 1 ? `Edit ${String.fromCharCode(65 + variantIndex)}` : `Edit ${String.fromCharCode(65 + variantIndex)}.${index + 1}`,
              prompt: current.photoDirectorInstruction,
              module: 'photo-director',
              createdAt,
              editStepId: stepId,
              qualityScore: 84 + index,
              modelRuns: [runId],
              metadata: {
                aspectRatio: nextAspectRatio,
                polishMode: current.photoDirectorPolishMode,
              },
            });

            runs.push({
              id: runId,
              jobId,
              provider: 'internal-router',
              model: current.photoDirectorPolishMode === 'focused' ? 'precise-edit-mock' : 'balanced-edit-mock',
              inputPrompt: current.photoDirectorInstruction,
              inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 2100 + index * 180,
              costEstimate: 0.04,
              createdAt,
            });

            qaList.push({
              id: qualityId,
              versionId,
              projectId: current.project.id,
              identityPreservation: 'high',
              objectPreservation: 'high',
              styleConsistency: current.photoDirectorPolishMode === 'bold' ? 'medium' : 'high',
              commercialUsefulness: 'high',
              artifactRisk: current.photoDirectorPolishMode === 'bold' ? 'medium' : 'low',
              labels: [
                current.photoDirectorPolishMode === 'focused' ? 'Jen doladit' : 'Photo Director',
                index === 0 ? 'Nejvernejsi' : 'Nova vetev',
              ],
              summary: 'The requested change was kept focused and preserved the locked areas.',
              createdAt,
            });

            steps.push({
              id: stepId,
              projectId: current.project.id,
              fromVersionId: activeVersion?.id,
              toVersionIds: [versionId],
              userInstruction: current.photoDirectorInstruction,
              agentSummary: `Preserved ${current.photoDirectorLockedText} and created a more polished continuation of the current direction.`,
              lockedAreaIds: current.lockedAreas.map((area) => area.id),
              visualCanonId: current.visualCanon.id,
              createdAt,
              module: 'photo-director',
            });
            outputVersionIds.push(versionId);
          }

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            editSteps: [...steps, ...current.editSteps],
            jobs: [
              {
                id: jobId,
                projectId: current.project.id,
                module: 'photo-director',
                status: 'succeeded',
                progress: 100,
                input: {
                  instruction: current.photoDirectorInstruction,
                  locked: current.photoDirectorLockedText,
                  outputCount: current.photoDirectorOutputCount,
                  aspectRatio: nextAspectRatio,
                  polishMode: current.photoDirectorPolishMode,
                },
                outputVersionIds,
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0],
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 900);
  };

  const handleRegenerateFromCanvas = async (sourceVersionId: string, prompt: string, referenceAssetIds: string[] = []) => {
    if (props.activeRoute !== 'mulen') return;

    setIsGenerating(true);
    setWorkspaceNote('Photo Director regeneruje vybranou verzi podle upraveneho promptu.');

    try {
      if (props.apiConfig?.features.photoDirector) {
        const sourceVersion = workspace.versions.find((version) => version.id === sourceVersionId);
        const sourceAspectRatio = (sourceVersion?.metadata?.aspectRatio as 'original' | 'square' | 'portrait' | 'landscape' | undefined) ?? 'original';
        const job = await api.createPhotoDirectorJob({
          projectId: workspace.project.id,
          instruction: prompt,
          lockedText: workspace.photoDirectorLockedText,
          outputCount: 1,
          aspectRatio: sourceAspectRatio,
          polishMode: workspace.photoDirectorPolishMode,
          promptMode,
          simpleLinkMode,
          advancedVariant,
          faceIdentityMode,
          sourceVersionId,
          useSourceImage: true,
          useReferenceImages: referenceAssetIds.length > 0,
          temporaryReferenceAssetIds: referenceAssetIds,
          modelId: selectedModelId,
        });

        const finalJob = await waitForJob(job.id, (progressJob) => {
          setWorkspaceNote(`Photo Director regeneruje: ${progressJob.progress}%`);
        });

        const nextSnapshot = await syncWorkspaceFromApi();
        const activeVersion = nextSnapshot.versions.find((version) => version.id === nextSnapshot.project.activeVersionId);
        setWorkspaceNote(
          finalJob.status === 'succeeded'
            ? `Nova verze ${activeVersion?.label ?? 'je hotova'} byla ulozena do historie.`
            : 'Regenerace skoncila, ale backend vratil neplny nebo chybovy stav.',
        );
      } else {
        setInstruction(prompt);
        await handleGenerate();
        return;
      }
    } catch (error) {
      setWorkspaceNote(error instanceof Error ? error.message : 'Regenerace obrazku selhala.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVariants = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'variant-lab',
        jobInput: {
          count: workspace.variantLabCount,
          intensity: workspace.variantLabIntensity,
          instruction: workspace.photoDirectorInstruction,
          promptMode,
          simpleLinkMode,
          advancedVariant,
          faceIdentityMode,
          sourceVersionId: workspace.project.activeVersionId,
        },
        startMessage: 'Variant Lab odesila batch do backend job systemu.',
        progressLabel: 'Variant Lab bezi',
        successMessage: (nextSnapshot) => {
          const outputCount = nextSnapshot.jobs[0]?.outputVersionIds?.length ?? workspace.variantLabCount;
          return `Variant Lab vytvoril ${outputCount} novych smeru a ulozil je do galerie projektu.`;
        },
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Variant Lab pripravuje batch novych smeru pri zachovani hlavni identity fotky.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const createdAt = new Date().toISOString();
          const labels = ['Nejvernejsi', 'Nejlepsi pro reklamu', 'Nejlepsi pro web', 'Nejlepsi pro socialni site', 'Nejodvaznejsi'];
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const runs: ModelRun[] = [];
          const qaList: QualityEvaluation[] = [];
          const outputVersionIds: string[] = [];
          const count = current.variantLabCount;

          for (let index = 0; index < count; index += 1) {
            const assetId = `asset-variantlab-${Date.now()}-${index}`;
            const versionId = `version-variantlab-${Date.now()}-${index}`;
            const runId = `run-variantlab-${Date.now()}-${index}`;
            const qualityId = `qa-variantlab-${Date.now()}-${index}`;
            const imageUrl = MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length];
            const label = labels[index % labels.length];

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: imageUrl,
              storagePath: `mock/generated/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: activeVersion?.id,
              assetId,
              label: `Variant ${index + 1}`,
              prompt: `${current.photoDirectorInstruction} [${current.variantLabIntensity}]`,
              module: 'variant-lab',
              createdAt,
              qualityScore: 80 + (index % 10),
              modelRuns: [runId],
            });

            runs.push({
              id: runId,
              jobId: 'job-variant-batch-latest',
              provider: 'internal-router',
              model: `creative-variation-${current.variantLabIntensity}`,
              inputPrompt: current.photoDirectorInstruction,
              inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 1600 + index * 120,
              costEstimate: 0.03,
              createdAt,
            });

            qaList.push({
              id: qualityId,
              versionId,
              projectId: current.project.id,
              identityPreservation: 'high',
              objectPreservation: 'high',
              styleConsistency: 'medium',
              commercialUsefulness: 'high',
              artifactRisk: current.variantLabIntensity === 'odvazne' ? 'medium' : 'low',
              labels: [label],
              summary: `Variant ${index + 1} keeps the main object and explores a ${current.variantLabIntensity} direction.`,
              createdAt,
            });

            outputVersionIds.push(versionId);
          }

          const batchJob: GenerationJob = {
            id: `job-variant-batch-${Date.now()}`,
            projectId: current.project.id,
            module: 'variant-lab',
            status: 'succeeded',
            progress: 100,
            input: {
              count: current.variantLabCount,
              intensity: current.variantLabIntensity,
              instruction: current.photoDirectorInstruction,
            },
            outputVersionIds,
            createdAt,
            updatedAt: createdAt,
          };

          setWorkspaceNote(`Variant Lab navazal na ${activeVersion?.label ?? 'aktivni verzi'} a vytvoril ${count} novych smeru.`);

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            jobs: [batchJob, ...current.jobs],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0] ?? current.project.activeVersionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 1100);
  };

  const handleGenerateUpscale = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'photo-director',
        jobInput: {
          workflow: 'ai-upscaler',
          scale: workspace.aiUpscalerScale,
          mode: workspace.aiUpscalerMode,
          creativity: workspace.aiUpscalerCreativity,
          resemblance: workspace.aiUpscalerResemblance,
          sourceVersionId: workspace.project.activeVersionId,
        },
        startMessage: `AI Upscaler odesila ${workspace.aiUpscalerScale.toUpperCase()} branch do backendu.`,
        progressLabel: 'AI Upscaler bezi',
        successMessage: (nextSnapshot) => {
          const activeVersion = nextSnapshot.versions.find((version) => version.id === nextSnapshot.project.activeVersionId);
          return `Upscale branch ${activeVersion?.label ?? 'je hotovy'} byl ulozen do project memory.`;
        },
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote(`AI Upscaler pripravuje novou ${workspace.aiUpscalerScale.toUpperCase()} verzi bez ztraty historie projektu.`);

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const assetId = `asset-upscale-${Date.now()}`;
          const versionId = `version-upscale-${Date.now()}`;
          const runId = `run-upscale-${Date.now()}`;
          const qaId = `qa-upscale-${Date.now()}`;
          const jobId = `job-upscale-${Date.now()}`;

          const asset: Asset = {
            id: assetId,
            projectId: current.project.id,
            userId: current.project.userId,
            kind: 'generated',
            url: MOCK_GENERATED_IMAGES[current.versions.length % MOCK_GENERATED_IMAGES.length],
            storagePath: `mock/upscale/${versionId}.jpg`,
            mimeType: 'image/jpeg',
            createdAt,
            metadata: {
              workflow: 'ai-upscaler',
              workflowLabel: 'AI Upscaler',
              scale: current.aiUpscalerScale,
              mode: current.aiUpscalerMode,
              creativity: current.aiUpscalerCreativity,
              resemblance: current.aiUpscalerResemblance,
            },
          };

          const version: ImageVersion = {
            id: versionId,
            projectId: current.project.id,
            parentVersionId: activeVersion?.id,
            assetId,
            label: `Upscale ${current.aiUpscalerScale.toUpperCase()}`,
            prompt: `Upscale ${current.aiUpscalerScale} · ${current.aiUpscalerMode}`,
            module: 'photo-director',
            createdAt,
            modelRuns: [runId],
            qualityScore: 91,
            metadata: {
              workflow: 'ai-upscaler',
              workflowLabel: 'AI Upscaler',
              scale: current.aiUpscalerScale,
              mode: current.aiUpscalerMode,
              creativity: current.aiUpscalerCreativity,
              resemblance: current.aiUpscalerResemblance,
            },
          };

          const run: ModelRun = {
            id: runId,
            jobId,
            provider: 'internal-router',
            model: 'upscale-mock',
            inputPrompt: version.prompt ?? '',
            inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
            outputAssetId: assetId,
            status: 'succeeded',
            latencyMs: 1800,
            costEstimate: 0.02,
            createdAt,
          };

          const qa: QualityEvaluation = {
            id: qaId,
            versionId,
            projectId: current.project.id,
            identityPreservation: 'high',
            objectPreservation: 'high',
            styleConsistency: 'high',
            commercialUsefulness: 'high',
            artifactRisk: 'low',
            labels: ['AI Upscaler', current.aiUpscalerScale.toUpperCase()],
            summary: 'Upscaled branch preserved the current direction and prepared a higher-resolution continuation.',
            createdAt,
          };

          const job: GenerationJob = {
            id: jobId,
            projectId: current.project.id,
            module: 'photo-director',
            status: 'succeeded',
            progress: 100,
            input: {
              workflow: 'ai-upscaler',
              scale: current.aiUpscalerScale,
              mode: current.aiUpscalerMode,
              creativity: current.aiUpscalerCreativity,
              resemblance: current.aiUpscalerResemblance,
            },
            outputVersionIds: [versionId],
            createdAt,
            updatedAt: createdAt,
          };

          return {
            ...current,
            assets: [asset, ...current.assets],
            versions: [version, ...current.versions],
            jobs: [job, ...current.jobs],
            modelRuns: [run, ...current.modelRuns],
            qualityEvaluations: [qa, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: versionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 650);
  };

  const handleGenerateModelInfluence = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'variant-lab',
        jobInput: {
          workflow: 'model-influence',
          prompt: workspace.modelInfluencePrompt,
          strength: workspace.modelInfluenceStrength,
          sourceVersionId: workspace.project.activeVersionId,
        },
        startMessage: 'Model Influence posila dve rizene varianty do backendu.',
        progressLabel: 'Model Influence bezi',
        successMessage: () => 'Model Influence vytvoril nove vetve bez ztraty hlavniho smeru.',
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Model Influence pripravuje varianty, ktere meni feeling modelu bez ztraty smeru.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const outputVersionIds: string[] = [];
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const runs: ModelRun[] = [];
          const qaList: QualityEvaluation[] = [];
          const jobId = `job-model-influence-${Date.now()}`;

          ['A', 'B'].forEach((variant, index) => {
            const assetId = `asset-model-influence-${Date.now()}-${index}`;
            const versionId = `version-model-influence-${Date.now()}-${index}`;
            const runId = `run-model-influence-${Date.now()}-${index}`;
            const qaId = `qa-model-influence-${Date.now()}-${index}`;

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length],
              storagePath: `mock/model-influence/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
              metadata: {
                workflow: 'model-influence',
                workflowLabel: 'Model Influence',
                strength: current.modelInfluenceStrength,
              },
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: activeVersion?.id,
              assetId,
              label: `Model Influence ${variant}`,
              prompt: current.modelInfluencePrompt,
              module: 'variant-lab',
              createdAt,
              modelRuns: [runId],
              qualityScore: 83 + index,
              metadata: {
                workflow: 'model-influence',
                workflowLabel: 'Model Influence',
                strength: current.modelInfluenceStrength,
              },
            });

            runs.push({
              id: runId,
              jobId,
              provider: 'internal-router',
              model: `model-influence-${current.modelInfluenceStrength}`,
              inputPrompt: current.modelInfluencePrompt,
              inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 1450 + index * 120,
              costEstimate: 0.025,
              createdAt,
            });

            qaList.push({
              id: qaId,
              versionId,
              projectId: current.project.id,
              identityPreservation: 'high',
              objectPreservation: 'medium',
              styleConsistency: 'high',
              commercialUsefulness: 'high',
              artifactRisk: current.modelInfluenceStrength === 'high' ? 'medium' : 'low',
              labels: ['Model Influence', current.modelInfluenceStrength === 'high' ? 'Silny posun' : 'Kontrolovany posun'],
              summary: 'Influence branch shifted the overall rendering feel while preserving the main image anchor.',
              createdAt,
            });

            outputVersionIds.push(versionId);
          });

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            jobs: [
              {
                id: jobId,
                projectId: current.project.id,
                module: 'variant-lab',
                status: 'succeeded',
                progress: 100,
                input: {
                  workflow: 'model-influence',
                  prompt: current.modelInfluencePrompt,
                  strength: current.modelInfluenceStrength,
                },
                outputVersionIds,
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0],
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 700);
  };

  const handleGenerateStyleTransfer = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'photo-director',
        jobInput: {
          workflow: 'style-transfer',
          prompt: workspace.styleTransferPrompt,
          preserveComposition: workspace.styleTransferPreserveComposition,
          sourceVersionId: workspace.project.activeVersionId,
        },
        startMessage: 'Style Transfer odesila novy branch do backendu.',
        progressLabel: 'Style Transfer bezi',
        successMessage: () => 'Style Transfer vytvoril nove stylove vetve navazane na aktivni verzi.',
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Style Transfer pripravuje novy branch ve stylu Nano, ale s pameti projektu navic.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const outputVersionIds: string[] = [];
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const qaList: QualityEvaluation[] = [];
          const runs: ModelRun[] = [];
          const jobId = `job-style-transfer-${Date.now()}`;

          for (let index = 0; index < 2; index += 1) {
            const assetId = `asset-style-transfer-${Date.now()}-${index}`;
            const versionId = `version-style-transfer-${Date.now()}-${index}`;
            const runId = `run-style-transfer-${Date.now()}-${index}`;
            const qaId = `qa-style-transfer-${Date.now()}-${index}`;

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length],
              storagePath: `mock/style-transfer/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
              metadata: {
                workflow: 'style-transfer',
                workflowLabel: 'Style Transfer',
                preserveComposition: current.styleTransferPreserveComposition,
              },
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: activeVersion?.id,
              assetId,
              label: `Style Transfer ${index + 1}`,
              prompt: current.styleTransferPrompt,
              module: 'photo-director',
              createdAt,
              modelRuns: [runId],
              qualityScore: 85 + index,
              metadata: {
                workflow: 'style-transfer',
                workflowLabel: 'Style Transfer',
                preserveComposition: current.styleTransferPreserveComposition,
              },
            });

            runs.push({
              id: runId,
              jobId,
              provider: 'internal-router',
              model: current.styleTransferPreserveComposition ? 'style-transfer-preserve' : 'style-transfer-free',
              inputPrompt: current.styleTransferPrompt,
              inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 1700 + index * 120,
              costEstimate: 0.03,
              createdAt,
            });

            qaList.push({
              id: qaId,
              versionId,
              projectId: current.project.id,
              identityPreservation: 'high',
              objectPreservation: current.styleTransferPreserveComposition ? 'high' : 'medium',
              styleConsistency: 'high',
              commercialUsefulness: 'high',
              artifactRisk: 'low',
              labels: ['Style Transfer', current.styleTransferPreserveComposition ? 'Zachovana kompozice' : 'Volnejsi styl'],
              summary: 'Transferred styling while keeping the branch linked to the current active image history.',
              createdAt,
            });

            outputVersionIds.push(versionId);
          }

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            jobs: [
              {
                id: jobId,
                projectId: current.project.id,
                module: 'photo-director',
                status: 'succeeded',
                progress: 100,
                input: {
                  workflow: 'style-transfer',
                  prompt: current.styleTransferPrompt,
                  preserveComposition: current.styleTransferPreserveComposition,
                },
                outputVersionIds,
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0],
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 700);
  };

  const handleGenerateMultiAngle = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'multi-angle-reframe',
        jobInput: {
          setType: workspace.multiAngleSetType,
          shotCount: workspace.multiAngleShotCount,
          precision: workspace.multiAnglePrecision,
          sourceVersionId: workspace.project.activeVersionId,
        },
        startMessage: 'Multi-Angle Reframe odesila camera set do backendu.',
        progressLabel: 'Multi-Angle bezi',
        successMessage: () =>
          `Multi-Angle Reframe vytvoril ${workspace.multiAngleShotCount} zaberu. Nektere uhly jsou AI interpretace, ne presna dokumentace reality.`,
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Multi-Angle Reframe pripravuje camera plan a siri aktivni smer do cele sady zaberu.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
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
          const jobId = `job-multi-angle-${Date.now()}`;
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const runs: ModelRun[] = [];
          const qaList: QualityEvaluation[] = [];
          const steps: EditStep[] = [];
          const outputVersionIds: string[] = [];

          for (let index = 0; index < current.multiAngleShotCount; index += 1) {
            const assetId = `asset-multi-angle-${Date.now()}-${index}`;
            const versionId = `version-multi-angle-${Date.now()}-${index}`;
            const runId = `run-multi-angle-${Date.now()}-${index}`;
            const qualityId = `qa-multi-angle-${Date.now()}-${index}`;
            const stepId = `step-multi-angle-${Date.now()}-${index}`;
            const imageUrl = MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length];
            const cameraLabel = shotLabels[index] ?? `Shot ${index + 1}`;
            const qaLabel = qaLabels[index % qaLabels.length];

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: imageUrl,
              storagePath: `mock/generated/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
              metadata: {
                cameraPurpose: qaLabel,
                cameraPlan: cameraLabel,
                setType: current.multiAngleSetType,
              },
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: activeVersion?.id,
              assetId,
              label: cameraLabel,
              prompt: `Create a ${current.multiAngleSetType} camera-set shot that preserves the object, materials and brand direction.`,
              module: 'multi-angle-reframe',
              createdAt,
              qualityScore: 82 + (index % 7),
              modelRuns: [runId],
              metadata: {
                cameraPurpose: qaLabel,
                precision: current.multiAnglePrecision,
              },
            });

            runs.push({
              id: runId,
              jobId,
              provider: 'internal-router',
              model: `multi-angle-${current.multiAnglePrecision}`,
              inputPrompt: `Generate ${cameraLabel} for the same visual canon.`,
              inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 1800 + index * 150,
              costEstimate: 0.035,
              createdAt,
            });

            qaList.push({
              id: qualityId,
              versionId,
              projectId: current.project.id,
              identityPreservation: 'high',
              objectPreservation: 'high',
              styleConsistency: 'high',
              commercialUsefulness: 'high',
              artifactRisk: current.multiAnglePrecision === 'kreativni' ? 'medium' : 'low',
              labels: [qaLabel],
              summary: `${cameraLabel} keeps the same object and extends the camera plan into a new angle.`,
              createdAt,
            });

            steps.push({
              id: stepId,
              projectId: current.project.id,
              fromVersionId: activeVersion?.id,
              toVersionIds: [versionId],
              userInstruction: `Vytvor camera set: ${current.multiAngleSetType}`,
              agentSummary: `Planned camera set shot ${cameraLabel} while preserving the active visual canon.`,
              lockedAreaIds: current.lockedAreas.map((area) => area.id),
              visualCanonId: current.visualCanon.id,
              createdAt,
              module: 'multi-angle-reframe',
            });

            outputVersionIds.push(versionId);
          }

          setWorkspaceNote(
            `Multi-Angle Reframe vytvoril ${current.multiAngleShotCount} zaberu ze stejneho smeru. Nektere uhly jsou interpretace, ne dokumentace reality.`,
          );

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            editSteps: [...steps, ...current.editSteps],
            jobs: [
              {
                id: jobId,
                projectId: current.project.id,
                module: 'multi-angle-reframe',
                status: 'succeeded',
                progress: 100,
                input: {
                  setType: current.multiAngleSetType,
                  shotCount: current.multiAngleShotCount,
                  precision: current.multiAnglePrecision,
                },
                outputVersionIds,
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0] ?? current.project.activeVersionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 1200);
  };

  const handleGenerateHeadswap = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'headswap',
        jobInput: {
          sourceAssetId: workspace.headswapSourceAssetId,
          targetAssetId: workspace.headswapTargetAssetId ?? workspace.project.originalAssetId,
          hairMode: workspace.headswapHairMode,
        },
        startMessage: 'HeadSwap Studio odesila ctyri paralelni porovnani do backendu.',
        progressLabel: 'HeadSwap bezi',
        successMessage: () => 'HeadSwap Studio vytvorilo 4 paralelni vysledky pripravenych pro dalsi doladeni.',
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('HeadSwap Studio porovnava ctyri ruzne vysledky a uklada je jako samostatne vetve.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const sourceAssetId = current.headswapSourceAssetId;
          const targetAssetId = current.headswapTargetAssetId ?? current.project.originalAssetId;
          const labels = ['nejlepsi identita', 'nejlepsi blending', 'nejprirozenejsi plet', 'nejlepsi svetlo'];
          const jobId = `job-headswap-${Date.now()}`;
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const runs: ModelRun[] = [];
          const qaList: QualityEvaluation[] = [];
          const steps: EditStep[] = [];
          const outputVersionIds: string[] = [];

          for (let index = 0; index < 4; index += 1) {
            const assetId = `asset-headswap-${Date.now()}-${index}`;
            const versionId = `version-headswap-${Date.now()}-${index}`;
            const runId = `run-headswap-${Date.now()}-${index}`;
            const qualityId = `qa-headswap-${Date.now()}-${index}`;
            const stepId = `step-headswap-${Date.now()}-${index}`;
            const label = labels[index];
            const imageUrl = MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length];

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: imageUrl,
              storagePath: `mock/generated/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
              metadata: {
                hairMode: current.headswapHairMode,
                headswapLabel: label,
              },
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: current.project.activeVersionId,
              assetId,
              label: `HeadSwap ${index + 1}`,
              prompt: `Compare headswap result with ${label} priority.`,
              module: 'headswap',
              createdAt,
              qualityScore: 79 + index,
              modelRuns: [runId],
              metadata: {
                headswapLabel: label,
              },
            });

            runs.push({
              id: runId,
              jobId,
              provider: 'internal-router',
              model: `headswap-model-${index + 1}`,
              inputPrompt: `Blend source identity into target with ${label} priority.`,
              inputAssetIds: [sourceAssetId, targetAssetId].filter(Boolean) as string[],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 1700 + index * 150,
              costEstimate: 0.05,
              createdAt,
            });

            qaList.push({
              id: qualityId,
              versionId,
              projectId: current.project.id,
              identityPreservation: index === 0 ? 'high' : 'medium',
              objectPreservation: 'high',
              styleConsistency: 'medium',
              commercialUsefulness: 'high',
              artifactRisk: 'low',
              labels: [label],
              summary: `This headswap output prioritizes ${label}.`,
              createdAt,
            });

            steps.push({
              id: stepId,
              projectId: current.project.id,
              fromVersionId: current.project.activeVersionId,
              toVersionIds: [versionId],
              userInstruction: 'Porovnej vice headswap modelu.',
              agentSummary: `Created a comparison branch for ${label}.`,
              lockedAreaIds: current.lockedAreas.map((area) => area.id),
              visualCanonId: current.visualCanon.id,
              createdAt,
              module: 'headswap',
            });

            outputVersionIds.push(versionId);
          }

          setWorkspaceNote('HeadSwap Studio vytvorilo 4 paralelni vysledky, ktere je mozne dal jednotlive rozvijet.');

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            editSteps: [...steps, ...current.editSteps],
            jobs: [
              {
                id: jobId,
                projectId: current.project.id,
                module: 'headswap',
                status: 'succeeded',
                progress: 100,
                input: {
                  sourceAssetId,
                  targetAssetId,
                  hairMode: current.headswapHairMode,
                },
                outputVersionIds,
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0] ?? current.project.activeVersionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 1050);
  };

  const handleRefineHeadswap = (versionId: string) => {
    const note = workspace.headswapNotes[versionId]?.trim();
    if (!note) {
      setWorkspaceNote('Nejdriv napis, co chces u konkretni headswap varianty doladit.');
      return;
    }

    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'headswap',
        jobInput: {
          workflow: 'refine',
          baseVersionId: versionId,
          note,
        },
        startMessage: `HeadSwap dolaďuje variantu podle poznamky: ${note}`,
        progressLabel: 'HeadSwap refine bezi',
        successMessage: () => 'Vybrana headswap vetev byla doladena a ulozena jako nova verze.',
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote(`HeadSwap dolaďuje variantu podle poznamky: ${note}`);

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const baseVersion = current.versions.find((version) => version.id === versionId);
          if (!baseVersion) return current;

          const createdAt = new Date().toISOString();
          const assetId = `asset-headswap-refine-${Date.now()}`;
          const refinedVersionId = `version-headswap-refine-${Date.now()}`;
          const runId = `run-headswap-refine-${Date.now()}`;
          const stepId = `step-headswap-refine-${Date.now()}`;
          const qualityId = `qa-headswap-refine-${Date.now()}`;

          return {
            ...current,
            assets: [
              {
                id: assetId,
                projectId: current.project.id,
                userId: current.project.userId,
                kind: 'generated',
                url: MOCK_GENERATED_IMAGES[current.versions.length % MOCK_GENERATED_IMAGES.length],
                storagePath: `mock/generated/${refinedVersionId}.jpg`,
                mimeType: 'image/jpeg',
                createdAt,
              },
              ...current.assets,
            ],
            versions: [
              {
                id: refinedVersionId,
                projectId: current.project.id,
                parentVersionId: versionId,
                assetId,
                label: `${baseVersion.label} refine`,
                prompt: note,
                module: 'headswap',
                createdAt,
                modelRuns: [runId],
                qualityScore: 86,
              },
              ...current.versions,
            ],
            editSteps: [
              {
                id: stepId,
                projectId: current.project.id,
                fromVersionId: versionId,
                toVersionIds: [refinedVersionId],
                userInstruction: note,
                agentSummary: 'Refined a selected headswap branch with a targeted correction request.',
                lockedAreaIds: current.lockedAreas.map((area) => area.id),
                visualCanonId: current.visualCanon.id,
                createdAt,
                module: 'headswap',
              },
              ...current.editSteps,
            ],
            modelRuns: [
              {
                id: runId,
                jobId: `job-headswap-refine-${Date.now()}`,
                provider: 'internal-router',
                model: 'headswap-refine',
                inputPrompt: note,
                inputAssetIds: [baseVersion.assetId],
                outputAssetId: assetId,
                status: 'succeeded',
                latencyMs: 1600,
                costEstimate: 0.03,
                createdAt,
              },
              ...current.modelRuns,
            ],
            qualityEvaluations: [
              {
                id: qualityId,
                versionId: refinedVersionId,
                projectId: current.project.id,
                identityPreservation: 'high',
                objectPreservation: 'high',
                styleConsistency: 'medium',
                commercialUsefulness: 'high',
                artifactRisk: 'low',
                labels: ['dolažena varianta'],
                summary: 'A selected headswap output was refined with a targeted note.',
                createdAt,
              },
              ...current.qualityEvaluations,
            ],
            project: {
              ...current.project,
              activeVersionId: refinedVersionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 850);
  };

  const handleGenerateVisualGuide = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'visual-guide',
        jobInput: {
          prompt: workspace.visualGuidePrompt,
          stepCount: workspace.visualGuideStepCount,
          style: workspace.visualGuideStyle,
          output: workspace.visualGuideOutput,
          sourceVersionId: workspace.project.activeVersionId,
        },
        startMessage: 'Visual Guide odesila serii kroku do backendu.',
        progressLabel: 'Visual Guide bezi',
        successMessage: () => `Visual Guide vytvoril ${workspace.visualGuideStepCount} kroku v jedne konzistentni serii.`,
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Visual Guide planuje kroky, anchor frame a opakujici se objekty pro celou serii.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const assets: Asset[] = [];
          const versions: ImageVersion[] = [];
          const runs: ModelRun[] = [];
          const qaList: QualityEvaluation[] = [];
          const steps: EditStep[] = [];
          const outputVersionIds: string[] = [];
          const jobId = `job-visual-guide-${Date.now()}`;

          for (let index = 0; index < current.visualGuideStepCount; index += 1) {
            const assetId = `asset-guide-${Date.now()}-${index}`;
            const versionId = `version-guide-${Date.now()}-${index}`;
            const runId = `run-guide-${Date.now()}-${index}`;
            const qualityId = `qa-guide-${Date.now()}-${index}`;
            const stepId = `step-guide-${Date.now()}-${index}`;

            assets.push({
              id: assetId,
              projectId: current.project.id,
              userId: current.project.userId,
              kind: 'generated',
              url: MOCK_GENERATED_IMAGES[(current.versions.length + index) % MOCK_GENERATED_IMAGES.length],
              storagePath: `mock/generated/${versionId}.jpg`,
              mimeType: 'image/jpeg',
              createdAt,
              metadata: {
                stepNumber: index + 1,
                caption: `Krok ${index + 1}`,
              },
            });

            versions.push({
              id: versionId,
              projectId: current.project.id,
              parentVersionId: activeVersion?.id,
              assetId,
              label: `Krok ${index + 1}`,
              prompt: current.visualGuidePrompt,
              module: 'visual-guide',
              createdAt,
              modelRuns: [runId],
              qualityScore: 83,
            });

            runs.push({
              id: runId,
              jobId,
              provider: 'internal-router',
              model: 'visual-guide-step',
              inputPrompt: `Generate step ${index + 1} for: ${current.visualGuidePrompt}`,
              inputAssetIds: activeVersion ? [activeVersion.assetId] : [],
              outputAssetId: assetId,
              status: 'succeeded',
              latencyMs: 1400 + index * 100,
              costEstimate: 0.025,
              createdAt,
            });

            qaList.push({
              id: qualityId,
              versionId,
              projectId: current.project.id,
              styleConsistency: 'high',
              commercialUsefulness: 'high',
              artifactRisk: 'low',
              labels: [`krok ${index + 1}`],
              summary: `Step ${index + 1} remains consistent with the guide series.`,
              createdAt,
            });

            steps.push({
              id: stepId,
              projectId: current.project.id,
              fromVersionId: activeVersion?.id,
              toVersionIds: [versionId],
              userInstruction: current.visualGuidePrompt,
              agentSummary: `Prepared guide step ${index + 1} with shared visual canon.`,
              lockedAreaIds: current.lockedAreas.map((area) => area.id),
              visualCanonId: current.visualCanon.id,
              createdAt,
              module: 'visual-guide',
            });

            outputVersionIds.push(versionId);
          }

          setWorkspaceNote(`Visual Guide vytvoril ${current.visualGuideStepCount} kroku z jedne vety a drzi je v jedne serii.`);

          return {
            ...current,
            assets: [...assets, ...current.assets],
            versions: [...versions, ...current.versions],
            editSteps: [...steps, ...current.editSteps],
            jobs: [
              {
                id: jobId,
                projectId: current.project.id,
                module: 'visual-guide',
                status: 'succeeded',
                progress: 100,
                input: {
                  prompt: current.visualGuidePrompt,
                  stepCount: current.visualGuideStepCount,
                  style: current.visualGuideStyle,
                  output: current.visualGuideOutput,
                },
                outputVersionIds,
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            modelRuns: [...runs, ...current.modelRuns],
            qualityEvaluations: [...qaList, ...current.qualityEvaluations],
            project: {
              ...current.project,
              activeVersionId: outputVersionIds[0] ?? current.project.activeVersionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 1150);
  };

  const handleGenerateInfographic = () => {
    if (props.apiConfig?.ok) {
      void runBackendJob({
        module: 'infographic-generator',
        jobInput: {
          topic: workspace.infographicTopic,
          type: workspace.infographicType,
          format: workspace.infographicFormat,
          theme: workspace.infographicTheme,
        },
        startMessage: 'Infographic Generator odesila layout render do backendu.',
        progressLabel: 'Infographic bezi',
        successMessage: () => 'Infographic byl vyrenderovan jako skutecny layout s ostrym textem.',
      });
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Infographic Generator sklada realny textovy layout, ne bitmapu s rozsypanymi pismeny.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const versionId = `version-infographic-${Date.now()}`;
          const assetId = `asset-infographic-${Date.now()}`;
          const runId = `run-infographic-${Date.now()}`;
          const qualityId = `qa-infographic-${Date.now()}`;
          const sections = [
            { title: 'Kontext', body: 'Kdy je vhodne dane tema resit a proc na nem zalezi.' },
            { title: 'Srovnani', body: 'Nejdulezitejsi rozdily ve zkratce a jasne strukture.' },
            { title: 'Doporuceni', body: 'Jak by mel ctenar tema pouzit v praxi.' },
          ];

          setWorkspaceNote('Infographic byl vyrenderovan jako strukturovany layout s ostrym textem a pripraveny pro dalsi export.');

          return {
            ...current,
            assets: [
              {
                id: assetId,
                projectId: current.project.id,
                userId: current.project.userId,
                kind: 'export',
                url: 'infographic-layout',
                storagePath: `mock/exports/${versionId}.html`,
                mimeType: 'text/html',
                createdAt,
                metadata: {
                  layout: {
                    title: current.infographicTopic,
                    theme: current.infographicTheme,
                    format: current.infographicFormat,
                    sections,
                  },
                },
              },
              ...current.assets,
            ],
            versions: [
              {
                id: versionId,
                projectId: current.project.id,
                parentVersionId: current.project.activeVersionId,
                assetId,
                label: 'Infographic layout',
                prompt: current.infographicTopic,
                module: 'infographic-generator',
                createdAt,
                modelRuns: [runId],
                qualityScore: 90,
                metadata: {
                  infographic: true,
                },
              },
              ...current.versions,
            ],
            modelRuns: [
              {
                id: runId,
                jobId: `job-infographic-${Date.now()}`,
                provider: 'internal-router',
                model: 'infographic-layout',
                inputPrompt: current.infographicTopic,
                inputAssetIds: [],
                outputAssetId: assetId,
                status: 'succeeded',
                latencyMs: 1100,
                costEstimate: 0.02,
                createdAt,
              },
              ...current.modelRuns,
            ],
            qualityEvaluations: [
              {
                id: qualityId,
                versionId,
                projectId: current.project.id,
                styleConsistency: 'high',
                commercialUsefulness: 'high',
                artifactRisk: 'low',
                labels: ['ostry text', 'layout render'],
                summary: 'The infographic was rendered as real structured content instead of AI text in pixels.',
                createdAt,
              },
              ...current.qualityEvaluations,
            ],
            jobs: [
              {
                id: `job-infographic-${Date.now()}`,
                projectId: current.project.id,
                module: 'infographic-generator',
                status: 'succeeded',
                progress: 100,
                input: {
                  topic: current.infographicTopic,
                  type: current.infographicType,
                  format: current.infographicFormat,
                  theme: current.infographicTheme,
                },
                outputVersionIds: [versionId],
                createdAt,
                updatedAt: createdAt,
              },
              ...current.jobs,
            ],
            project: {
              ...current.project,
              activeVersionId: versionId,
              updatedAt: createdAt,
            },
          };
        });
        setIsGenerating(false);
      });
    }, 900);
  };

  const handleCreateExport = async () => {
    if (props.apiConfig?.features.export) {
      setIsGenerating(true);
      setWorkspaceNote('Backend pripravuje export z aktivni verze.');

      try {
        await api.createExport({
          projectId: workspace.project.id,
          versionId: workspace.project.activeVersionId,
          format: workspace.exportFormat,
          useCase: workspace.exportUseCase,
          workflow: props.activeRoute,
        });
        const nextSnapshot = await syncWorkspaceFromApi();
        const exportAsset = nextSnapshot.assets.find((asset) => asset.kind === 'export');
        setWorkspaceNote(`Export ${workspace.exportFormat.toUpperCase()} pro ${workspace.exportUseCase} je pripraveny: ${exportAsset?.storagePath ?? 'mock/export'}.`);
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Export se nepodarilo pripravit.');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    setIsGenerating(true);
    setWorkspaceNote('Pripravuji export z aktivni verze podle zvoleneho formatu a pouziti.');

    window.setTimeout(() => {
      startTransition(() => {
        setWorkspace((current) => {
          const createdAt = new Date().toISOString();
          const activeVersion = current.versions.find((version) => version.id === current.project.activeVersionId) ?? current.versions[0];
          const activeRoute = props.activeRoute;
          let normalizedFormat = current.exportFormat;
          if (activeRoute === 'reframe' && current.exportFormat === 'html') normalizedFormat = 'pdf';
          if (activeRoute === 'face-swap' && current.exportFormat === 'html') normalizedFormat = 'jpg';
          if (activeRoute === 'visual-guide' && current.exportFormat === 'html') normalizedFormat = 'pdf';
          if (activeRoute === 'infographic' && current.exportFormat === 'jpg') normalizedFormat = 'png';
          const extension = normalizedFormat === 'html' ? 'html' : normalizedFormat;
          const assetId = `asset-export-${Date.now()}`;
          const baseName = activeVersion?.label?.toLowerCase().replace(/\s+/g, '-') ?? 'version';
          const prefix =
            activeRoute === 'ai-upscaler'
              ? 'upscale'
              : activeRoute === 'face-swap'
                ? 'headswap'
                : activeRoute === 'reframe'
                  ? 'reframe'
                  : activeRoute === 'variant-lab'
                    ? 'variant-lab'
                    : activeRoute === 'visual-guide'
                      ? 'visual-guide'
                      : activeRoute === 'infographic'
                        ? 'infographic'
                        : 'image';
          const exportPath = `mock/exports/${prefix}-${baseName}.${extension}`;
          const mimeType =
            normalizedFormat === 'pdf'
              ? 'application/pdf'
              : normalizedFormat === 'html'
                ? 'text/html'
                : normalizedFormat === 'jpg'
                  ? 'image/jpeg'
                  : 'image/png';

          setWorkspaceNote(`Export ${normalizedFormat.toUpperCase()} pro ${current.exportUseCase} je pripraveny z verze ${activeVersion?.label ?? 'aktivni verze'}.`);

          return {
            ...current,
            assets: [
              {
                id: assetId,
                projectId: current.project.id,
                userId: current.project.userId,
                kind: 'export',
                url: activeVersion ? getAsset(current, activeVersion)?.url ?? 'export' : 'export',
                storagePath: exportPath,
                mimeType,
                createdAt,
                metadata: {
                  sourceVersionId: activeVersion?.id,
                  useCase: current.exportUseCase,
                  format: normalizedFormat,
                  module: activeVersion?.module,
                  workflow: activeRoute,
                },
              },
              ...current.assets,
            ],
          };
        });
        setIsGenerating(false);
      });
    }, 700);
  };

  const handleDeleteVersion = (versionId: string) => {
    deletedVersionIdsRef.current.add(versionId);
    // Optimistic local update
    startTransition(() => {
      setWorkspace((current) => {
        const version = current.versions.find((v) => v.id === versionId);
        const assetId = version?.assetId;
        const wasActive = current.project.activeVersionId === versionId;
        const remainingVersions = current.versions.filter((v) => v.id !== versionId);
        const newActiveVersionId = wasActive
          ? (remainingVersions.find((v) => v.module === 'photo-director')?.id ?? remainingVersions[0]?.id ?? current.project.activeVersionId)
          : current.project.activeVersionId;
        return {
          ...current,
          versions: remainingVersions,
          assets: assetId ? current.assets.filter((a) => a.id !== assetId) : current.assets,
          project: { ...current.project, activeVersionId: newActiveVersionId },
          jobs: current.jobs.map((job) => ({
            ...job,
            outputVersionIds: job.outputVersionIds.filter((id) => id !== versionId),
          })),
        };
      });
    });
    // Persist to backend
    void api.deleteVersion(versionId);
  };

  const handleDeleteRow = (jobId: string) => {
    deletedJobIdsRef.current.add(jobId);
    const job = workspace.jobs.find((item) => item.id === jobId);
    job?.outputVersionIds.forEach((versionId) => deletedVersionIdsRef.current.add(versionId));
    // Optimistic local update
    startTransition(() => {
      setWorkspace((current) => {
        const job = current.jobs.find((j) => j.id === jobId);
        if (!job) return current;
        const versionIds = new Set(job.outputVersionIds);
        const versionsToRemove = current.versions.filter((v) => versionIds.has(v.id));
        const assetIdsToRemove = new Set(versionsToRemove.map((v) => v.assetId).filter(Boolean));
        const wasActive = versionIds.has(current.project.activeVersionId);
        const remainingVersions = current.versions.filter((v) => !versionIds.has(v.id));
        const newActiveVersionId = wasActive
          ? (remainingVersions.find((v) => v.module === 'photo-director')?.id ?? remainingVersions[0]?.id ?? current.project.activeVersionId)
          : current.project.activeVersionId;
        return {
          ...current,
          jobs: current.jobs.filter((j) => j.id !== jobId),
          versions: remainingVersions,
          assets: current.assets.filter((a) => !assetIdsToRemove.has(a.id)),
          project: { ...current.project, activeVersionId: newActiveVersionId },
        };
      });
    });
    // Persist to backend
    void api.deleteJob(jobId);
  };

  const handleResetToActive = () => {
    const activeVersion = workspace.versions.find((version) => version.id === workspace.project.activeVersionId);
    setWorkspaceNote(`Pracovni smer je znovu ukotveny na verzi ${activeVersion?.label ?? 'aktivni verze'}.`);
  };

  const handleContinueFromActive = () => {
    const activeVersion = workspace.versions.find((version) => version.id === workspace.project.activeVersionId);
    setWorkspaceNote(`Dalsi generovani navaze z verze ${activeVersion?.label ?? 'aktivni verze'}.`);
  };

  const primaryActionByRoute: Record<NanoRoute, () => void> = {
    mulen: handleGenerate,
    'ai-upscaler': handleGenerateUpscale,
    'face-swap': handleGenerateHeadswap,
    reframe: handleGenerateMultiAngle,
    'variant-lab': handleGenerateVariants,
    'visual-guide': handleGenerateVisualGuide,
    infographic: handleGenerateInfographic,
  };

  const activeMemoryVersion = workspace.versions.find((version) => version.id === workspace.project.activeVersionId) ?? workspace.versions[0];

  return (
    <div className={props.theme === 'dark' ? 'workspace workspace-dark' : 'workspace workspace-light'}>
      <div className="nano-layout-grid">
        <NanoLeftSidebar
          snapshot={workspace}
          activeRoute={props.activeRoute}
          onGenerate={handleGenerate}
          onGenerateVariants={handleGenerateVariants}
          onInstructionChange={setInstruction}
          onLockedTextChange={setLockedText}
          onUploadImage={handleUploadImage}
          onUploadReference={handleUploadReference}
          onHeadswapSourceUpload={handleHeadswapSourceUpload}
          onHeadswapTargetUpload={handleHeadswapTargetUpload}
          onSelectExistingAsset={handleSelectExistingAsset}
          onOutputCountChange={setOutputCount}
          onVariantCountChange={setVariantCount}
          onVariantIntensityChange={setVariantIntensity}
          onMultiAngleSetTypeChange={setMultiAngleSetType}
          onMultiAngleShotCountChange={setMultiAngleShotCount}
          onMultiAnglePrecisionChange={setMultiAnglePrecision}
          onHeadswapHairModeChange={setHeadswapHairMode}
          onUpscalerScaleChange={setUpscalerScale}
          onUpscalerModeChange={setUpscalerMode}
          onUpscalerCreativityChange={setUpscalerCreativity}
          onUpscalerResemblanceChange={setUpscalerResemblance}
          onModelInfluencePromptChange={setModelInfluencePrompt}
          onModelInfluenceStrengthChange={setModelInfluenceStrength}
          onStyleTransferPromptChange={setStyleTransferPrompt}
          onStyleTransferPreserveCompositionChange={setStyleTransferPreserveComposition}
          onVisualGuidePromptChange={setVisualGuidePrompt}
          onVisualGuideStepCountChange={setVisualGuideStepCount}
          onVisualGuideStyleChange={setVisualGuideStyle}
          onInfographicTopicChange={setInfographicTopic}
          onInfographicFormatChange={setInfographicFormat}
          onInfographicThemeChange={setInfographicTheme}
          onPrimaryAction={primaryActionByRoute[props.activeRoute]}
          isGenerating={isGenerating}
          canGenerate={canGenerate}
          onEnhancePrompt={handleEnhancePrompt}
          onUndoPromptEnhance={handleUndoPromptEnhance}
          onRedoPromptHistory={handleRedoPromptHistory}
          onSelectPromptHistoryEntry={handleSelectPromptHistoryEntry}
          onGeneratePromptVariants={handleGeneratePromptVariants}
          onApplyPromptVariant={(prompt) => setPromptValueForRoute(props.activeRoute, prompt)}
          onSemanticReferencePromptChange={setSemanticReferencePrompt}
          onToggleSemanticMixCategory={handleToggleSemanticMixCategory}
          onRunSemanticPromptRemix={handleRunSemanticPromptRemix}
          onOpenSavePrompt={handleOpenSavePrompt}
          onSavePrompt={handleSavePrompt}
          onLoadPrompt={handleLoadPrompt}
          onDeletePrompt={handleDeletePrompt}
          onSelectSavedPrompt={handleSelectSavedPrompt}
          onPromptModeChange={setPromptMode}
          onAdvancedVariantChange={setAdvancedVariant}
          onFaceIdentityModeChange={setFaceIdentityMode}
          advancedVariant={advancedVariant}
          faceIdentityMode={faceIdentityMode}
          promptMode={promptMode}
          canEnhancePrompt={Boolean(currentPromptValue.trim())}
          canUndoPromptEnhance={activePromptHistory.canUndo()}
          canRedoPromptHistory={activePromptHistory.canRedo()}
          canSavePrompt={Boolean(currentPromptValue.trim())}
          isEnhancingPrompt={isEnhancing}
          isSemanticRemixing={isSemanticRemixing}
          isGeneratingPromptVariants={isGeneratingPromptVariants}
          enhanceError={enhanceError}
          savedPrompts={savedPrompts}
          isSavedPromptsOpen={isSavedPromptsOpen}
          onToggleSavedPrompts={() => {
            setIsSavePromptOpen(false);
            setIsSavedPromptsOpen((current) => !current);
            setSelectedSavedPromptId((current) => current ?? savedPrompts[0]?.id ?? null);
          }}
          isSavePromptOpen={isSavePromptOpen}
          savedPromptDraftName={savedPromptDraftName}
          onSavedPromptDraftNameChange={setSavedPromptDraftName}
          onCloseSavePrompt={() => setIsSavePromptOpen(false)}
          selectedSavedPromptId={selectedSavedPromptId}
          currentPrompt={currentPromptValue}
          semanticReferencePrompt={semanticReferencePrompt}
          semanticMixSelection={semanticMixSelection}
          semanticPromptVariants={semanticPromptVariants}
          promptHistoryEntries={promptHistoryEntries}
          currentPromptHistoryEntryId={currentPromptHistoryEntryId}
          imageModelPresets={imageModelPresets}
          selectedModelId={selectedModelId}
          onModelSelect={setSelectedModelId}
        />
        <MainCanvas
          activeRoute={props.activeRoute}
          snapshot={workspace}
          onCreateExport={handleCreateExport}
          onSelectVersion={setActiveVersion}
          onUseVersionAsInput={handleUseVersionAsInput}
          isGenerating={isGenerating}
          generatingCount={workspace.photoDirectorOutputCount}
          onRegenerateVersion={handleRegenerateFromCanvas}
          onUploadReferenceAsset={uploadReferenceAssetToWorkspace}
          onDeleteVersion={handleDeleteVersion}
          onDeleteRow={handleDeleteRow}
        />
      </div>
      {props.activeRoute !== 'mulen' ? (
        <>
          <div className="memory-bottom-bar">
            <div className="workspace-note">{workspaceNote}</div>
            <TimelinePanel
              snapshot={workspace}
              onSelectVersion={setActiveVersion}
              onResetToActive={handleResetToActive}
              onContinueFromActive={handleContinueFromActive}
            />
          </div>
          <div className="edge-label">
            <PanelRight size={16} />
            <span>{activeMemoryVersion?.label ?? getNanoRouteLabel(props.activeRoute)}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
