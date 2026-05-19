import { useState } from 'react';
import { ImagePlus, UserRound } from 'lucide-react';
import type { Asset, ImageVersion } from '@mulen/shared';
import { AssetLibraryPopover } from '../../project/AssetLibraryPopover';

type HeadSwapPanelProps = {
  sourceAsset?: Asset;
  targetAsset?: Asset;
  hairMode: 'source' | 'target' | 'auto';
  resultVersions: ImageVersion[];
  versionNotes: Record<string, string>;
  libraryAssets: Asset[];
  onUploadSource: (file: File) => void;
  onUploadTarget: (file: File) => void;
  onSelectSourceAsset: (asset: Asset) => void;
  onSelectTargetAsset: (asset: Asset) => void;
  onHairModeChange: (value: 'source' | 'target' | 'auto') => void;
  onNoteChange: (versionId: string, value: string) => void;
  onRefineVariant: (versionId: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

function UploadBox(props: {
  title: string;
  subtitle: string;
  onUpload: (file: File) => void;
  onSelectAsset: (asset: Asset) => void;
  libraryAssets: Asset[];
  asset?: Asset;
}) {
  const [dragging, setDragging] = useState(false);

  const processFile = (fileList: FileList | File[]) => {
    const file = Array.from(fileList).find((item) => item.type.startsWith('image/'));
    if (file) props.onUpload(file);
  };

  return (
    <AssetLibraryPopover
      assets={props.libraryAssets}
      selectedAssetId={props.asset?.id}
      onSelectAsset={props.onSelectAsset}
      onUploadFile={props.onUpload}
      placement="left"
    >
      <label>
        {props.title}
        <div
          className={dragging ? 'upload-slot dragging mini' : 'upload-slot mini'}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files) processFile(event.dataTransfer.files);
          }}
        >
          <input
            accept="image/*"
            className="upload-input"
            onChange={(event) => {
              if (event.target.files) processFile(event.target.files);
            }}
            type="file"
          />
          {props.asset ? (
            <div className="inline-asset-preview">
              <img alt={props.subtitle} src={props.asset.url} />
              <span>{props.subtitle}</span>
            </div>
          ) : (
            <>
              <ImagePlus size={16} />
              <span>{props.subtitle}</span>
            </>
          )}
        </div>
      </label>
    </AssetLibraryPopover>
  );
}

export function HeadSwapPanel(props: HeadSwapPanelProps) {
  const resultVersions = props.resultVersions ?? [];

  return (
    <section className="panel-block nano-module-panel">
      <div className="section-heading nano-module-heading">
        <UserRound size={18} />
        <span>HeadSwap Studio</span>
      </div>
      <p className="nano-module-kicker">Parallel comparison</p>
      <UploadBox
        asset={props.sourceAsset}
        libraryAssets={props.libraryAssets}
        onSelectAsset={props.onSelectSourceAsset}
        onUpload={props.onUploadSource}
        subtitle={props.sourceAsset ? 'Zdrojova identita nactena' : 'Nahraj source face / head'}
        title="Zdrojova hlava"
      />
      <UploadBox
        asset={props.targetAsset}
        libraryAssets={props.libraryAssets}
        onSelectAsset={props.onSelectTargetAsset}
        onUpload={props.onUploadTarget}
        subtitle={props.targetAsset ? 'Cilova scena nactena' : 'Nahraj target image'}
        title="Cilovy obrazek"
      />
      <label>
        Vlasy
        <select value={props.hairMode} onChange={(event) => props.onHairModeChange(event.target.value as HeadSwapPanelProps['hairMode'])}>
          <option value="source">vlasy ze source</option>
          <option value="target">vlasy z targetu</option>
          <option value="auto">automaticky</option>
        </select>
      </label>
      <div className="variant-tags">
        <span>nejlepsi identita</span>
        <span>nejlepsi blending</span>
        <span>nejprirozenejsi plet</span>
        <span>nejlepsi svetlo</span>
      </div>
      <p className="module-note nano-module-note">
        Pouzivej jen s opravnenim dane osoby. Mulen tady porovnava vic vysledku vedle sebe, ne jeden nahodny swap.
      </p>
      {resultVersions.length > 0 ? (
        <div className="result-stack nano-result-stack">
          {resultVersions.slice(0, 4).map((version) => (
            <div className="result-card nano-result-card" key={version.id}>
              <strong>{version.label}</strong>
              <textarea
                value={props.versionNotes[version.id] ?? ''}
                onChange={(event) => props.onNoteChange(version.id, event.target.value)}
                placeholder="Treba: u teto varianty uprav krk nebo zachovej vic puvodni vyraz"
              />
              <button onClick={() => props.onRefineVariant(version.id)} type="button">
                Doladit tuto variantu
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="button-row nano-module-actions">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Generuji swapy...' : 'Porovnat 4 modely'}
        </button>
      </div>
    </section>
  );
}
