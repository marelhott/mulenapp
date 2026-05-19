import { Images } from 'lucide-react';
import type { Asset, ImageVersion, MulenModule, WorkspaceSnapshot } from '@mulen/shared';
import type { NanoRoute } from '../../types/nano';
import { getNanoRouteLabel } from '../../types/nano';

function getAsset(snapshot: WorkspaceSnapshot, version: ImageVersion): Asset | undefined {
  return snapshot.assets.find((asset) => asset.id === version.assetId);
}

export function OutputGallerySection(props: {
  snapshot: WorkspaceSnapshot;
  activeModule: MulenModule;
  activeRoute: NanoRoute;
  onSelectVersion?: (versionId: string) => void;
}) {
  const groups = groupVersionsByWorkflow(props.snapshot, props.activeRoute, props.activeModule);

  return (
    <section className="gallery-strip">
      <div className="section-heading">
        <Images size={18} />
        <span>Galerie vystupu projektu</span>
      </div>
      <div className="gallery-groups">
        {groups.map(([module, versions]) => (
          <section className="gallery-group" key={module}>
            <div className="gallery-group-header">
              <strong>{getWorkflowLabel(module)}</strong>
              <span>{versions.length} verzi</span>
            </div>
            <div className="gallery-grid">
              {versions.map((version) => {
                const asset = getAsset(props.snapshot, version);
                const qa = props.snapshot.qualityEvaluations.find((item) => item.versionId === version.id);
                const metadataLabel = getMetadataLabel(version, asset);

                return (
                  <article
                    className={version.id === props.snapshot.project.activeVersionId ? 'output-card active' : 'output-card'}
                    key={version.id}
                    onClick={() => props.onSelectVersion?.(version.id)}
                  >
                    {asset && asset.mimeType !== 'text/html' ? <img alt={version.label ?? 'Version'} src={asset.url} /> : <div className="output-card-placeholder">Layout</div>}
                    <div>
                      <div className="output-card-meta">
                        <strong>{version.label}</strong>
                        <span>{metadataLabel}</span>
                      </div>
                      <p>{qa?.labels.slice(0, 2).join(' · ') ?? 'Projektova verze'}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function groupVersionsByWorkflow(snapshot: WorkspaceSnapshot, activeRoute: NanoRoute, activeModule: MulenModule) {
  const order = [
    activeRoute,
    'mulen',
    'ai-upscaler',
    'face-swap',
    'reframe',
    'variant-lab',
    'visual-guide',
    'infographic',
    activeModule,
    'photo-director',
    'variant-lab',
    'multi-angle-reframe',
    'headswap',
    'visual-guide',
    'infographic-generator',
  ];

  const prioritized = order.filter((value, index) => order.indexOf(value) === index);

  return prioritized
    .map((groupKey) => [groupKey, snapshot.versions.filter((version) => getGroupKey(snapshot, version) === groupKey)] as const)
    .filter(([, items]) => items.length > 0);
}

function getWorkflowLabel(groupKey: string) {
  if (
    groupKey === 'mulen' ||
    groupKey === 'ai-upscaler' ||
    groupKey === 'face-swap' ||
    groupKey === 'reframe' ||
    groupKey === 'variant-lab' ||
    groupKey === 'visual-guide' ||
    groupKey === 'infographic'
  ) {
    return getNanoRouteLabel(groupKey as NanoRoute);
  }

  switch (groupKey as MulenModule) {
    case 'photo-director':
      return 'Photo Director';
    case 'variant-lab':
      return 'Variant Lab';
    case 'multi-angle-reframe':
      return 'Multi-Angle Reframe';
    case 'headswap':
      return 'HeadSwap Studio';
    case 'visual-guide':
      return 'Visual Guide';
    case 'infographic-generator':
      return 'Infographic Generator';
    default:
      return groupKey;
  }
}

function getGroupKey(snapshot: WorkspaceSnapshot, version: ImageVersion) {
  const asset = getAsset(snapshot, version);
  const workflow = (version.metadata?.workflow ?? asset?.metadata?.workflow) as string | undefined;
  return workflow ?? version.module;
}

function getMetadataLabel(version: ImageVersion, asset?: Asset) {
  const metadata = (version.metadata ?? asset?.metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.workflowLabel === 'string') return metadata.workflowLabel;
  if (typeof metadata.cameraPurpose === 'string') return metadata.cameraPurpose;
  if (typeof metadata.stepNumber === 'number') return `krok ${metadata.stepNumber}`;
  if (typeof metadata.headswapLabel === 'string') return metadata.headswapLabel;
  if (version.module === 'infographic-generator') return 'layout';
  return version.module;
}
