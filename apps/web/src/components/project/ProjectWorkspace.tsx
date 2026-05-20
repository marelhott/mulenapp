import { startTransition, useEffect, useRef, useState, useMemo } from 'react';
import { PanelRight } from 'lucide-react';
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
import { api, fileToDataUrl, setModel, type ApiConfig, waitForJob } from '../../lib/api';

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
  aiUpscalerFocus: 'full' | 'face' | 'product';
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
};

const SAVED_PROMPTS_STORAGE_KEY = 'mulen-saved-prompts';

const MOCK_GENERATED_IMAGES = [
  'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
];

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
    photoDirectorAspectRatio: 'original',
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
    aiUpscalerFocus: 'full',
    modelInfluencePrompt: 'Vylepsi materialy, presnost svetla a pocit finalni reklamni kvality.',
    modelInfluenceStrength: 'medium',
    styleTransferPrompt: 'Premium editorial daylight s cistsim pozadim a jemnejsim stylingem.',
    styleTransferPreserveComposition: true,
  };
}

function getAsset(snapshot: WorkspaceSnapshot, version: ImageVersion): Asset | undefined {
  return snapshot.assets.find((asset) => asset.id === version.assetId);
}

function MainCanvas(props: {
  snapshot: WorkspaceState;
  activeRoute: NanoRoute;
  onSelectVersion: (versionId: string) => void;
  onCreateExport: () => void;
  isGenerating: boolean;
  generatingCount?: number;
}) {
  const [zoomedVersionId, setZoomedVersionId] = useState<string | null>(null);
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
  const [showReferenceUpload, setShowReferenceUpload] = useState<Record<string, boolean>>({});

  // Sync newly persisted versions into sessionImages (only add, never pre-populate on mount)
  const seenVersionIds = useRef(new Set<string>());
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      // On first mount, mark all existing versions as "already seen" so they don't appear
      props.snapshot.versions
        .filter((v: ImageVersion) => v.module === 'photo-director')
        .forEach((v: ImageVersion) => seenVersionIds.current.add(v.id));
      isFirstMount.current = false;
      return;
    }
    // After first mount, detect newly added versions
    const photoVersions = props.snapshot.versions.filter((v: ImageVersion) => v.module === 'photo-director');
    photoVersions.forEach((version: ImageVersion) => {
      if (!seenVersionIds.current.has(version.id)) {
        seenVersionIds.current.add(version.id);
        const asset = getAsset(props.snapshot, version);
        if (asset && asset.mimeType !== 'text/html') {
          setSessionImages(prev => {
            // Replace loading placeholder if exists, or add new
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
              prompt: version.label || '',
              timestamp: Date.parse(version.createdAt || new Date().toISOString()),
              status: 'success' as const,
            }, ...prev];
          });
        }
      }
    });
  }, [props.snapshot.versions]);

  // When generation starts, add loading placeholder(s)
  const prevIsGenerating = useRef(false);
  useEffect(() => {
    if (props.isGenerating && !prevIsGenerating.current) {
      const count = props.generatingCount ?? 1;
      const placeholders = Array.from({ length: count }, (_, i) => ({
        id: `loading-${Date.now()}-${i}`,
        versionId: '',
        url: '',
        prompt: '',
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

  const successImages = sessionImages.filter(img => img.status === 'success' && img.url);
  const zoomedSessionImg = successImages.find(img => img.versionId === zoomedVersionId);

  return (
    <main className="main-canvas">
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
        <div className={props.activeRoute === 'mulen' ? 'nano-image-grid-container w-full h-full overflow-y-auto' : 'image-stage nano-image-stage'}>
          {props.activeRoute === 'mulen' ? (
            <div className="nano-image-grid">
              {/* Empty state */}
              {sessionImages.length === 0 && !props.isGenerating && (
                <div className="col-span-full flex flex-col items-center justify-center py-24 space-y-6">
                  <div style={{ animation: 'spin-slow 20s linear infinite' }}>
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <style>{`@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                      <circle cx="50" cy="50" r="2.5" fill="currentColor" className="text-white" />
                      <circle cx="50" cy="40" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="58" cy="44" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="60" cy="50" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="58" cy="56" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="50" cy="60" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="42" cy="56" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="40" cy="50" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="42" cy="44" r="2.2" fill="currentColor" style={{color:'#d1d5db'}} />
                      <circle cx="50" cy="30" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="64" cy="36" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="70" cy="50" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="64" cy="64" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="50" cy="70" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="36" cy="64" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="30" cy="50" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="36" cy="36" r="2" fill="currentColor" style={{color:'#6b7280'}} />
                      <circle cx="50" cy="20" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="70" cy="28" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="80" cy="50" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="70" cy="72" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="50" cy="80" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="30" cy="72" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="20" cy="50" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                      <circle cx="30" cy="28" r="1.5" fill="currentColor" style={{color:'#374151'}} />
                    </svg>
                  </div>
                  <div className="text-center space-y-1.5">
                    <span style={{fontSize:'10px',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.28em',color:'var(--text-soft)',display:'block'}}>
                      Zatím žádné vygenerované obrázky
                    </span>
                    <p style={{fontSize:'9px',fontWeight:500,color:'var(--text-secondary)'}}>
                      Zadejte prompt v postranním panelu (vlevo) a začněte tvořit
                    </p>
                  </div>
                </div>
              )}

              {/* Image cards (session images) */}
              {sessionImages.map((image) => (
                <article
                  key={image.id}
                  className="nano-image-card group flex flex-col overflow-hidden"
                  style={{animation: 'fadeIn 0.3s ease'}}
                >
                  {/* Image area */}
                  <div
                    className="relative bg-[var(--bg-panel)] cursor-zoom-in overflow-hidden"
                    style={{aspectRatio:'1/1'}}
                    onClick={() => image.status === 'success' && image.versionId && setZoomedVersionId(image.versionId)}
                  >
                    {image.status === 'loading' ? (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60" style={{backdropFilter:'blur(12px)',padding:'0 24px'}}>
                        <div style={{width:'100%',maxWidth:'200px'}}>
                          {/* Progress bar */}
                          <div style={{position:'relative',height:'2px',background:'#1f2937',borderRadius:'9999px',overflow:'hidden',marginBottom:'10px'}}>
                            <div
                              style={{
                                position:'absolute',inset:'0 auto 0 0',background:'#7ed957',
                                borderRadius:'9999px',boxShadow:'0 0 10px rgba(126,217,87,0.5)',
                                animation:'growWidth 10s cubic-bezier(0.4,0,0.2,1) forwards'
                              }}
                            />
                            <style>{`@keyframes growWidth { 0%{width:0%} 10%{width:15%} 40%{width:50%} 70%{width:80%} 100%{width:95%} }`}</style>
                          </div>
                          <div style={{textAlign:'center'}}>
                            <span style={{fontSize:'10px',color:'#7ed957',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',animation:'pulse 1.5s infinite'}}>Generuji...</span>
                          </div>
                        </div>
                      </div>
                    ) : image.status === 'error' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center" style={{background:'rgba(0,0,0,0.8)',backdropFilter:'blur(4px)'}}>
                        <div style={{width:40,height:40,background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,color:'#ef4444'}}>
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <p style={{fontSize:'10px',fontWeight:700,color:'#f87171',maxWidth:150,lineHeight:1.5}}>{image.error || 'Chyba generování'}</p>
                      </div>
                    ) : (
                      image.url && (
                        <img
                          src={image.url}
                          alt={image.prompt}
                          style={{width:'100%',height:'100%',objectFit:'contain',background:'var(--bg-contrast)'}}
                          decoding="sync"
                        />
                      )
                    )}
                  </div>

                  {/* Card footer */}
                  {image.status === 'success' && (
                    <>
                      <div style={{padding:'10px 14px',borderTop:'1px solid var(--border-color)',background:'var(--bg-card)',display:'flex',alignItems:'center',gap:8}}>
                        <p style={{fontSize:'9px',fontWeight:500,color:'var(--text-muted)',flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}} title={image.prompt}>
                          {image.prompt || '(bez promptu)'}
                        </p>
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          {/* Copy prompt */}
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(image.prompt); }}
                            style={{padding:'5px',background:'transparent',border:'none',cursor:'pointer',color:'var(--text-secondary)',borderRadius:4,transition:'background 0.15s'}}
                            title="Kopírovat prompt"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          </button>
                          {/* Download */}
                          <a
                            href={image.url}
                            download
                            onClick={(e) => e.stopPropagation()}
                            style={{padding:'5px',background:'transparent',border:'none',cursor:'pointer',color:'var(--text-secondary)',borderRadius:4,transition:'background 0.15s',display:'flex',alignItems:'center'}}
                            title="Stáhnout"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </a>
                          {/* Delete */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSessionImages(prev => prev.filter(img => img.id !== image.id)); }}
                            style={{padding:'5px',background:'transparent',border:'none',cursor:'pointer',color:'var(--text-secondary)',borderRadius:4,transition:'background 0.15s'}}
                            title="Smazat"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Inline edit */}
                      <div style={{padding:'10px 14px',borderTop:'1px solid var(--border-color)',background:'var(--bg-card)'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#7ed957"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            <span style={{fontSize:'9px',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-secondary)'}}>Upravit prompt</span>
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            {editPrompts[image.id] !== undefined && editPrompts[image.id] !== image.prompt && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditPrompts(prev => { const n = {...prev}; delete n[image.id]; return n; }); }}
                                style={{padding:'3px 8px',fontSize:'8px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',background:'var(--surface-highlight)',border:'none',borderRadius:4,cursor:'pointer',color:'var(--text-secondary)'}}
                              >Vrátit</button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowReferenceUpload(prev => ({...prev, [image.id]: !prev[image.id]})); }}
                              style={{
                                padding:'3px 8px',fontSize:'8px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',
                                background: showReferenceUpload[image.id] ? '#7ed957' : 'var(--bg-input)',
                                color: showReferenceUpload[image.id] ? '#0a0f0d' : 'var(--text-secondary)',
                                border: `1px solid ${showReferenceUpload[image.id] ? '#7ed957' : 'var(--border-color)'}`,
                                borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',gap:4
                              }}
                            >
                              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {showReferenceUpload[image.id] ? 'Skrýt' : '+ Obrázky'}
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={editPrompts[image.id] ?? image.prompt}
                          onChange={(e) => { e.stopPropagation(); setEditPrompts(prev => ({...prev, [image.id]: e.target.value})); }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Popište úpravy a stiskněte Regenerovat..."
                          rows={3}
                          style={{
                            width:'100%',background:'var(--bg-elevated)',border:'1px solid var(--border-color)',
                            borderRadius:6,padding:'8px',fontSize:'11px',color:'var(--text-primary)',
                            resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.5,
                            transition:'border-color 0.15s',boxSizing:'border-box'
                          }}
                        />

                        {/* Reference image upload strip */}
                        {showReferenceUpload[image.id] && (
                          <div style={{marginTop:8,padding:8,background:'var(--bg-elevated)',border:'1px solid var(--border-color)',borderRadius:6,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                            <label style={{display:'flex',alignItems:'center',justifyContent:'center',aspectRatio:'1/1',borderRadius:4,border:'1px dashed var(--border-strong)',cursor:'pointer',fontSize:18,color:'var(--text-secondary)',transition:'border-color 0.15s'}}>
                              +
                              <input type="file" multiple accept="image/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); }} />
                            </label>
                          </div>
                        )}

                        <button
                          disabled={!editPrompts[image.id]?.trim()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginTop:8,width:'100%',padding:'8px',
                            background:'linear-gradient(to right,rgba(59,130,246,0.2),rgba(37,99,235,0.2))',
                            color:'#60a5fa',border:'1px solid rgba(59,130,246,0.3)',borderRadius:6,
                            fontSize:'9px',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.1em',
                            cursor:'pointer',transition:'all 0.15s',opacity: editPrompts[image.id]?.trim() ? 1 : 0.5
                          }}
                        >
                          Regenerovat obrázek
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
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

      <div className="memory-drawer">
        <OutputGallerySection
          activeModule={activeModule}
          activeRoute={props.activeRoute}
          snapshot={props.snapshot}
          onSelectVersion={props.onSelectVersion}
        />
      </div>
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
            subtitle: `Fokus ${snapshot.aiUpscalerFocus}`,
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
        subtitle: `Scale ${snapshot.aiUpscalerScale.toUpperCase()} · focus ${snapshot.aiUpscalerFocus}`,
        compareLabel: 'Detail / Full',
        exportLabel: 'Export',
        badges: [snapshot.aiUpscalerScale.toUpperCase(), snapshot.aiUpscalerFocus === 'full' ? 'Cely obraz' : snapshot.aiUpscalerFocus],
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
          snapshot.photoDirectorAspectRatio,
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
  onUpscalerFocusChange: (value: 'full' | 'face' | 'product') => void;
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
  onOpenSavePrompt: () => void;
  onSavePrompt: () => void;
  onLoadPrompt: (text: string) => void;
  onDeletePrompt: (id: string) => void;
  onSelectSavedPrompt: (id: string) => void;
  promptMode: 'simple' | 'interpretation';
  canEnhancePrompt: boolean;
  canUndoPromptEnhance: boolean;
  canSavePrompt: boolean;
  isEnhancingPrompt: boolean;
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
}) {
  const referenceAssets = props.snapshot.assets.filter((asset) => asset.kind === 'reference');
  const originalAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.project.originalAssetId);
  const headswapSourceAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.headswapSourceAssetId);
  const headswapTargetAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.headswapTargetAssetId);
  const styleSlotAsset =
    props.snapshot.assets.find((asset) => asset.id === props.snapshot.styleSlotAssetId) ?? referenceAssets[0];
  const brandSlotAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.brandSlotAssetId);
  const [dragSection, setDragSection] = useState<'input' | 'style' | 'brand' | null>(null);
  const promptToolbarRef = useRef<HTMLDivElement | null>(null);
  const route = props.activeRoute;

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
    onUpscalerFocusChange: props.onUpscalerFocusChange,
    onModelInfluenceStrengthChange: props.onModelInfluenceStrengthChange,
    onStyleTransferPreserveCompositionChange: props.onStyleTransferPreserveCompositionChange,
    onVisualGuideStepCountChange: props.onVisualGuideStepCountChange,
    onVisualGuideStyleChange: props.onVisualGuideStyleChange,
    onInfographicFormatChange: props.onInfographicFormatChange,
    onInfographicThemeChange: props.onInfographicThemeChange,
  });
  const selectedSavedPrompt =
    props.savedPrompts.find((prompt) => prompt.id === props.selectedSavedPromptId) ?? props.savedPrompts[0] ?? null;

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

  return (
    <aside className="nano-left-panel">
      <section className="nano-action-panel">
        <button className={`nano-generate-button ${props.canGenerate ? 'ready' : ''}`} disabled={!props.canGenerate || props.isGenerating} onClick={props.onPrimaryAction} type="button">
          <span>{commandConfig.primaryLabel}</span>
          <small>{props.isGenerating ? commandConfig.loadingLabel : commandConfig.primaryMeta}</small>
        </button>
        <div className="nano-mini-actions">
          {commandConfig.quickActions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick}>
              <strong>{action.label}</strong>
              <small>{action.meta}</small>
            </button>
          ))}
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
          <div className="nano-prompt-header">
            <strong>{commandConfig.cardTitle}</strong>
          </div>
          {renderRouteCommandBody({
            route,
            snapshot: props.snapshot,
            onInstructionChange: props.onInstructionChange,
            onLockedTextChange: props.onLockedTextChange,
            onUpscalerScaleChange: props.onUpscalerScaleChange,
            onUpscalerFocusChange: props.onUpscalerFocusChange,
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
          {isPromptEnhanceableRoute(route) ? (
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
            >
              <UploadSection
                asset={config.asset}
                count={config.count}
                dragging={dragSection === config.dragKey}
                onBrowse={() => document.getElementById(config.id)?.click()}
                onDropFiles={(files) => handleFile(files, config.mode)}
                onDragStateChange={(active) => setDragSection(active ? config.dragKey : null)}
                title={config.title}
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
  onBrowse: () => void;
  onDropFiles: (files: FileList) => void;
  onDragStateChange: (active: boolean) => void;
}) {
  return (
    <section className="nano-upload-section">
      <div className="nano-upload-heading">
        <strong>{props.title}</strong>
        <span>{props.count}</span>
      </div>
      <button
        type="button"
        className={props.dragging ? 'nano-upload-box dragging' : 'nano-upload-box'}
        onClick={props.onBrowse}
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
        <span>+</span>
      </button>
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
    onUpscalerFocusChange: (value: 'full' | 'face' | 'product') => void;
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
        primaryLabel: 'Generovat',
        primaryMeta: `${snapshot.photoDirectorOutputCount} vystupu`,
        loadingLabel: 'Generuji...',
        quickActions: [
          { label: '3 varianty', meta: 'promptu', onClick: () => actions.onOutputCountChange(3) },
          { label: 'Vsechny', meta: 'modely', onClick: () => actions.onOutputCountChange(5) },
        ],
        optionRowLabel: 'Pocet obrazku',
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
        primaryLabel: 'Upscalovat',
        primaryMeta: `${snapshot.aiUpscalerScale.toUpperCase()} detail`,
        loadingLabel: 'Upskaluji...',
        quickActions: [
          { label: '2K', meta: 'rychle', onClick: () => actions.onUpscalerScaleChange('2k') },
          { label: '4K', meta: 'detail', onClick: () => actions.onUpscalerScaleChange('4k') },
        ],
        optionRowLabel: 'Fokus',
        optionRow: [
          { label: 'Full', active: snapshot.aiUpscalerFocus === 'full', onClick: () => actions.onUpscalerFocusChange('full') },
          { label: 'Face', active: snapshot.aiUpscalerFocus === 'face', onClick: () => actions.onUpscalerFocusChange('face') },
          { label: 'Prod', active: snapshot.aiUpscalerFocus === 'product', onClick: () => actions.onUpscalerFocusChange('product') },
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
  const baseStyleHelper = input.referenceAssets[0]?.storagePath ?? 'Stylove reference a look-and-feel';

  switch (input.route) {
    case 'face-swap':
      return [
        {
          id: 'nano-source-face-upload',
          dragKey: 'input' as const,
          mode: 'source-face' as const,
          title: 'Zdrojova hlava',
          count: input.headswapSourceAsset ? 1 : 0,
          helper: input.headswapSourceAsset?.storagePath ?? 'Nahraj source face / head',
          asset: input.headswapSourceAsset,
        },
        {
          id: 'nano-target-scene-upload',
          dragKey: 'style' as const,
          mode: 'target-scene' as const,
          title: 'Cilovy obrazek',
          count: input.headswapTargetAsset ? 1 : 0,
          helper: input.headswapTargetAsset?.storagePath ?? 'Nahraj target image',
          asset: input.headswapTargetAsset,
        },
        {
          id: 'nano-headswap-ref-upload',
          dragKey: 'brand' as const,
          mode: 'style' as const,
          title: 'Reference',
          count: input.referenceAssets.length,
          helper: input.styleSlotAsset?.storagePath ?? baseStyleHelper,
          asset: input.styleSlotAsset,
        },
      ];
    case 'reframe':
      return [
        {
          id: 'nano-reframe-source-upload',
          dragKey: 'input' as const,
          mode: 'input' as const,
          title: 'Zdrojovy zaber',
          count: input.originalAsset ? 1 : 0,
          helper: input.originalAsset?.storagePath ?? 'Nahraj produkt nebo scenu',
        },
        {
          id: 'nano-reframe-style-upload',
          dragKey: 'style' as const,
          mode: 'style' as const,
          title: 'Prostredi',
          count: input.referenceAssets.length,
          helper: input.styleSlotAsset?.storagePath ?? baseStyleHelper,
          asset: input.styleSlotAsset,
        },
        {
          id: 'nano-reframe-brand-upload',
          dragKey: 'brand' as const,
          mode: 'brand' as const,
          title: 'Brand prvky',
          count: input.brandSlotAsset ? 1 : input.lockedCount,
          helper: input.brandSlotAsset?.storagePath ?? 'Logo, material, mistnost nebo produkt ktery musi zustat konzistentni.',
          asset: input.brandSlotAsset,
        },
      ];
    default:
      return [
        {
          id: 'nano-input-upload',
          dragKey: 'input' as const,
          mode: 'input' as const,
          title: 'Vstupni obrazky',
          count: input.originalAsset ? 1 : 0,
          helper: input.originalAsset ? input.originalAsset.storagePath : 'Nahraj hlavni source fotku',
          asset: input.originalAsset,
        },
        {
          id: 'nano-style-upload',
          dragKey: 'style' as const,
          mode: 'style' as const,
          title: 'Stylove obrazky',
          count: input.referenceAssets.length,
          helper: input.styleSlotAsset?.storagePath ?? baseStyleHelper,
          asset: input.styleSlotAsset,
        },
        {
          id: 'nano-brand-upload',
          dragKey: 'brand' as const,
          mode: 'brand' as const,
          title: 'Proprietarni prvky',
          count: input.brandSlotAsset ? 1 : input.lockedCount,
          helper: input.brandSlotAsset?.storagePath ?? 'Logo / klobouk / boty / produkt. Neovlivnuje styl, pouze obsahove doplneni vystupu.',
          asset: input.brandSlotAsset,
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
  onUpscalerFocusChange: (value: 'full' | 'face' | 'product') => void;
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
  promptMode: 'simple' | 'interpretation';
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
                props.promptMode === 'interpretation'
                  ? 'Popiste obrazek prirozene. Vyberte variantu nize pro urceni stylu interpretace...'
                  : ''
              }
            />
          </div>
          <input
            value={props.snapshot.photoDirectorLockedText}
            onChange={(event) => props.onLockedTextChange(event.target.value)}
            placeholder="Co se nesmi zmenit"
          />
        </>
      );
    case 'ai-upscaler':
      return (
        <div className="nano-inline-fields">
          <label>
            Rozliseni
            <div className="segmented-control two-up">
              {(['2k', '4k'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={props.snapshot.aiUpscalerScale === value ? 'segment active' : 'segment'}
                  onClick={() => props.onUpscalerScaleChange(value)}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </label>
          <label>
            Fokus
            <div className="segmented-control">
              {([
                ['full', 'Cely'],
                ['face', 'Face'],
                ['product', 'Produkt'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={props.snapshot.aiUpscalerFocus === value ? 'segment active' : 'segment'}
                  onClick={() => props.onUpscalerFocusChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
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
  promptMode: 'simple' | 'interpretation';
  onPromptModeChange: (value: 'simple' | 'interpretation') => void;
  simpleLinkMode: 'style' | 'merge' | 'object' | null;
  onSimpleLinkModeChange: (value: 'style' | 'merge' | 'object') => void;
  advancedVariant: 'A' | 'B' | 'C';
  onAdvancedVariantChange: (value: 'A' | 'B' | 'C') => void;
  faceIdentityMode: boolean;
  onFaceIdentityModeChange: (value: boolean) => void;
  selectedModelId?: string;
  onModelSelect?: (modelId: string) => void;
}) {
  const imageModelPresets = [
    { id: 'gemini-flash', title: 'Nano 2', subtitle: 'Gemini 3.1 Flash' },
    { id: 'gemini-pro', title: 'Nano Pro', subtitle: 'Gemini 3 Pro' },
    { id: 'openai-image', title: 'GPT Img 2', subtitle: 'OpenAI' },
    { id: 'flux-pro', title: 'Flux Pro', subtitle: 'fal.ai' },
  ];

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
      {/* Model selection grid */}
      <div className="nano-model-grid">
        {imageModelPresets.map((preset) => {
          const isActive = props.selectedModelId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={isActive ? 'nano-model-option active' : 'nano-model-option'}
              onClick={() => props.onModelSelect?.(preset.id)}
              title={`${preset.title} — ${preset.subtitle}`}
            >
              <div className="nano-model-title">{preset.title}</div>
              <div className="nano-model-subtitle">{preset.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Prompt mode tabs */}
      {props.activeRoute === 'mulen' ? (
        <div className="nano-prompt-mode-tabs">
          <button
            type="button"
            className={props.promptMode === 'simple' ? 'nano-prompt-mode-tab active' : 'nano-prompt-mode-tab'}
            onClick={() => props.onPromptModeChange('simple')}
          >
            Simple
          </button>
          <button
            type="button"
            className={props.promptMode === 'interpretation' ? 'nano-prompt-mode-tab active' : 'nano-prompt-mode-tab'}
            onClick={() => props.onPromptModeChange('interpretation')}
          >
            Interpretace
          </button>
        </div>
      ) : null}

      {/* Simple / Interpretation options */}
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
            </button>
          ))}
        </div>
      ) : (
        <div className="nano-prompt-mode-advanced">
          <div className="nano-prompt-mode-grid advanced">
            {advancedOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={props.advancedVariant === option.id ? 'nano-prompt-mode-option active' : 'nano-prompt-mode-option'}
                onClick={() => props.onAdvancedVariantChange(option.id)}
              >
                <strong>{option.label}</strong>
                <span className="nano-option-summary">{option.summary}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={props.faceIdentityMode ? 'nano-face-identity-card active' : 'nano-face-identity-card'}
            onClick={() => props.onFaceIdentityModeChange(!props.faceIdentityMode)}
          >
            <span className="nano-face-toggle" aria-hidden="true">
              <i />
            </span>
            <span>
              <strong>Zachování identity tváře</strong>
            </span>
          </button>
        </div>
      )}
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
  const [previousPromptBeforeEnhance, setPreviousPromptBeforeEnhance] = useState<{ route: NanoRoute; value: string } | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [promptMode, setPromptMode] = useState<'simple' | 'interpretation'>('simple');
  const [simpleLinkMode, setSimpleLinkMode] = useState<'style' | 'merge' | 'object' | null>(null);
  const [advancedVariant, setAdvancedVariant] = useState<'A' | 'B' | 'C'>('C');
  const [faceIdentityMode, setFaceIdentityMode] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [isSavedPromptsOpen, setIsSavedPromptsOpen] = useState(false);
  const [isSavePromptOpen, setIsSavePromptOpen] = useState(false);
  const [savedPromptDraftName, setSavedPromptDraftName] = useState('');
  const [selectedSavedPromptId, setSelectedSavedPromptId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-flash');

  useEffect(() => {
    setModel(selectedModelId).catch(console.error);
  }, [selectedModelId]);

  const canGenerate = useMemo(() => {
    switch (props.activeRoute) {
      case 'mulen':
        return workspace.photoDirectorInstruction.trim() !== '' || snapshot.assets.some((a: Asset) => a.kind === 'reference') || !!workspace.project.originalAssetId;
      case 'ai-upscaler':
        return !!workspace.project.originalAssetId;
      case 'face-swap':
        return !!workspace.headswapSourceAssetId && !!workspace.headswapTargetAssetId;
      case 'reframe':
        return !!workspace.project.originalAssetId;
      case 'variant-lab':
        return workspace.variantLabPrompt?.trim() !== '' || !!workspace.project.originalAssetId;
      case 'visual-guide':
        return workspace.visualGuidePrompt?.trim() !== '';
      case 'infographic':
        return workspace.infographicTopic?.trim() !== '';
      default:
        return true;
    }
  }, [props.activeRoute, workspace, snapshot.assets]);

  const syncWorkspaceFromApi = async () => {
    const nextSnapshot = await api.getProject(workspace.project.id);
    startTransition(() => {
      setWorkspace((current) => {
        const next = createWorkspaceState(nextSnapshot);
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
      setWorkspace(createWorkspaceState(snapshot));
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
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SAVED_PROMPTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<Partial<SavedPrompt> & { prompt?: string }>;
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((item) => item && typeof item.id === 'string' && (typeof item.text === 'string' || typeof item.prompt === 'string'))
          .map((item) => {
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
            };
          });
        setSavedPrompts(normalized);
        setSelectedSavedPromptId(normalized[0]?.id ?? null);
      }
    } catch {
      // Keep UI usable even if localStorage contains invalid data.
    }
  }, []);

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
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        photoDirectorInstruction: value,
      }));
    });
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

  const setPromptValueForRoute = (route: NanoRoute, value: string) => {
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
      setPreviousPromptBeforeEnhance({ route, value: currentPrompt });
      setPromptValueForRoute(route, response.prompt);
    } catch (error) {
      setEnhanceError(error instanceof Error ? 'Prompt se nepodarilo vylepsit.' : 'Prompt se nepodarilo vylepsit.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUndoPromptEnhance = () => {
    if (!previousPromptBeforeEnhance || previousPromptBeforeEnhance.route !== props.activeRoute) return;
    setPromptValueForRoute(previousPromptBeforeEnhance.route, previousPromptBeforeEnhance.value);
    setPreviousPromptBeforeEnhance(null);
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

  const handleSavePrompt = () => {
    const text = getPromptValueForRoute(props.activeRoute, workspace).trim();
    const name = savedPromptDraftName.trim();
    if (!text || !name) {
      setEnhanceError('Prompt i nazev musi byt vyplnene.');
      return;
    }
    const nextPrompt: SavedPrompt = {
      id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      text,
      createdAt: new Date().toISOString(),
    };
    persistSavedPrompts([nextPrompt, ...savedPrompts]);
    setEnhanceError(null);
    setIsSavedPromptsOpen(false);
    setIsSavePromptOpen(false);
    setSavedPromptDraftName('');
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
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        visualGuidePrompt: value,
      }));
    });
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
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        infographicTopic: value,
      }));
    });
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

  const setUpscalerFocus = (value: 'full' | 'face' | 'product') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        aiUpscalerFocus: value,
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

  const setAspectRatio = (value: 'original' | 'square' | 'portrait' | 'landscape') => {
    startTransition(() => {
      setWorkspace((current) => ({
        ...current,
        photoDirectorAspectRatio: value,
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

  const handleUploadReference = async (file: File, slot: 'style' | 'brand' = 'style') => {
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
      } catch (error) {
        setWorkspaceNote(error instanceof Error ? error.message : 'Upload reference selhal.');
      }
      return;
    }

    const fileUrl = URL.createObjectURL(file);
    const createdAt = new Date().toISOString();
    setWorkspaceNote(`Reference ${file.name} byla pridana do Visual Canon jako dalsi voditko pro konzistenci.`);

    startTransition(() => {
      setWorkspace((current) => {
        const assetId = `asset-reference-${Date.now()}`;

        const nextAsset: Asset = {
          id: assetId,
          projectId: current.project.id,
          userId: current.project.userId,
          kind: 'reference',
          url: fileUrl,
          storagePath: `mock/references/${file.name}`,
          mimeType: file.type || 'image/jpeg',
          createdAt,
        };

        return {
          ...current,
          assets: [nextAsset, ...current.assets],
          styleSlotAssetId: slot === 'style' ? assetId : current.styleSlotAssetId,
          brandSlotAssetId: slot === 'brand' ? assetId : current.brandSlotAssetId,
          visualCanon: {
            ...current.visualCanon,
            referenceAssetIds: [current.project.originalAssetId, assetId].filter(Boolean) as string[],
            updatedAt: createdAt,
          },
        };
      });
    });
  };

  const handleSelectExistingAsset = (asset: Asset, slot: 'input' | 'style' | 'brand' | 'source-face' | 'target-scene') => {
    const createdAt = new Date().toISOString();

    startTransition(() => {
      setWorkspace((current) => {
        switch (slot) {
          case 'input': {
            const matchingVersion = current.versions.find((version) => version.assetId === asset.id);
            return {
              ...current,
              project: {
                ...current.project,
                originalAssetId: asset.id,
                activeVersionId: matchingVersion?.id ?? current.project.activeVersionId,
                updatedAt: createdAt,
              },
            };
          }
          case 'style':
            return {
              ...current,
              styleSlotAssetId: asset.id,
              visualCanon: {
                ...current.visualCanon,
                referenceAssetIds: Array.from(new Set([asset.id, ...current.visualCanon.referenceAssetIds])),
                updatedAt: createdAt,
              },
            };
          case 'brand':
            return {
              ...current,
              brandSlotAssetId: asset.id,
              visualCanon: {
                ...current.visualCanon,
                referenceAssetIds: Array.from(new Set([asset.id, ...current.visualCanon.referenceAssetIds])),
                updatedAt: createdAt,
              },
            };
          case 'source-face':
            return {
              ...current,
              headswapSourceAssetId: asset.id,
            };
          case 'target-scene':
            return {
              ...current,
              headswapTargetAssetId: asset.id,
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
      setIsGenerating(true);
      setWorkspaceNote('Photo Director odesila zadani do backend job systemu a ceka na novou verzi.');

      try {
        const job = await api.createPhotoDirectorJob({
          projectId: workspace.project.id,
          instruction: workspace.photoDirectorInstruction,
          lockedText: workspace.photoDirectorLockedText,
          outputCount: workspace.photoDirectorOutputCount,
          aspectRatio: workspace.photoDirectorAspectRatio,
          polishMode: workspace.photoDirectorPolishMode,
          promptMode,
          simpleLinkMode,
          advancedVariant,
          faceIdentityMode,
          sourceVersionId: workspace.project.activeVersionId,
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
                aspectRatio: current.photoDirectorAspectRatio,
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
                aspectRatio: current.photoDirectorAspectRatio,
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
                  aspectRatio: current.photoDirectorAspectRatio,
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
          focus: workspace.aiUpscalerFocus,
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
              focus: current.aiUpscalerFocus,
            },
          };

          const version: ImageVersion = {
            id: versionId,
            projectId: current.project.id,
            parentVersionId: activeVersion?.id,
            assetId,
            label: `Upscale ${current.aiUpscalerScale.toUpperCase()}`,
            prompt: `Upscale ${current.aiUpscalerScale} with focus ${current.aiUpscalerFocus}`,
            module: 'photo-director',
            createdAt,
            modelRuns: [runId],
            qualityScore: 91,
            metadata: {
              workflow: 'ai-upscaler',
              workflowLabel: 'AI Upscaler',
              scale: current.aiUpscalerScale,
              focus: current.aiUpscalerFocus,
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
              focus: current.aiUpscalerFocus,
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
          onUpscalerFocusChange={setUpscalerFocus}
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
          onOpenSavePrompt={handleOpenSavePrompt}
          onSavePrompt={handleSavePrompt}
          onLoadPrompt={handleLoadPrompt}
          onDeletePrompt={handleDeletePrompt}
          onSelectSavedPrompt={handleSelectSavedPrompt}
          promptMode={promptMode}
          canEnhancePrompt={Boolean(getPromptValueForRoute(props.activeRoute, workspace).trim())}
          canUndoPromptEnhance={Boolean(previousPromptBeforeEnhance && previousPromptBeforeEnhance.route === props.activeRoute)}
          canSavePrompt={Boolean(getPromptValueForRoute(props.activeRoute, workspace).trim())}
          isEnhancingPrompt={isEnhancing}
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
        />
        <MainCanvas
          activeRoute={props.activeRoute}
          snapshot={workspace}
          onCreateExport={handleCreateExport}
          onSelectVersion={setActiveVersion}
          isGenerating={isGenerating}
        />
        <NanoRightSidebar
          activeRoute={props.activeRoute}
          promptMode={promptMode}
          onPromptModeChange={setPromptMode}
          simpleLinkMode={simpleLinkMode}
          onSimpleLinkModeChange={(value) => setSimpleLinkMode((current) => (current === value ? null : value))}
          advancedVariant={advancedVariant}
          onAdvancedVariantChange={setAdvancedVariant}
          faceIdentityMode={faceIdentityMode}
          onFaceIdentityModeChange={setFaceIdentityMode}
          selectedModelId={selectedModelId}
          onModelSelect={setSelectedModelId}
        />
      </div>
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
    </div>
  );
}
