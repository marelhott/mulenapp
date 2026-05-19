import { FolderOpen, ImagePlus, Sparkles } from 'lucide-react';
import type { Asset, WorkspaceSnapshot } from '@mulen/shared';

function AssetCard(props: {
  asset?: Asset;
  title: string;
  subtitle: string;
  emptyLabel: string;
  onUpload?: () => void;
  isPrimary?: boolean;
}) {
  return (
    <article className={props.isPrimary ? 'asset-card primary' : 'asset-card'}>
      <div className="asset-card-header">
        <div>
          <p>{props.title}</p>
          <strong>{props.subtitle}</strong>
        </div>
        {props.onUpload ? (
          <button className="asset-card-action" onClick={props.onUpload} type="button">
            <ImagePlus size={14} />
          </button>
        ) : null}
      </div>
      <div className="asset-card-body">
        {props.asset ? (
          <img alt={props.subtitle} src={props.asset.url} />
        ) : (
          <div className="asset-card-empty">
            <ImagePlus size={16} />
            <span>{props.emptyLabel}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function InputDeck(props: {
  snapshot: WorkspaceSnapshot;
  onUploadOriginal: () => void;
  onUploadReference: () => void;
}) {
  const originalAsset = props.snapshot.assets.find((asset) => asset.id === props.snapshot.project.originalAssetId);
  const referenceAssets = props.snapshot.assets.filter((asset) => asset.kind === 'reference').slice(0, 2);

  return (
    <section className="input-deck">
      <div className="section-heading">
        <FolderOpen size={18} />
        <span>Vstupni sada projektu</span>
      </div>
      <div className="input-deck-grid">
        <AssetCard
          asset={originalAsset}
          emptyLabel="Nahraj hlavni vstup"
          isPrimary
          onUpload={props.onUploadOriginal}
          subtitle="Hlavni fotka"
          title="Source"
        />
        <div className="asset-column">
          <AssetCard
            asset={referenceAssets[0]}
            emptyLabel="Pridej referenci stylu nebo brandu"
            onUpload={props.onUploadReference}
            subtitle={referenceAssets[0] ? 'Reference stylu' : 'Volitelna reference'}
            title="Reference"
          />
          <div className="asset-note">
            <Sparkles size={15} />
            <div>
              <strong>Visual Canon</strong>
              <span>
                Referencni obrazky pomahaji drzet svetlo, materialy a celkovy smer bez zbytecneho rozbití sceny.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
