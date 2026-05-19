import { Download } from 'lucide-react';
import type { Asset, WorkspaceSnapshot } from '@mulen/shared';
import type { NanoRoute } from '../../types/nano';

export function ExportPanel(props: {
  snapshot: WorkspaceSnapshot;
  activeRoute: NanoRoute;
  exportFormat: 'png' | 'jpg' | 'pdf' | 'html';
  exportUseCase: 'web' | 'social' | 'print' | 'archive';
  onExportFormatChange: (value: 'png' | 'jpg' | 'pdf' | 'html') => void;
  onExportUseCaseChange: (value: 'web' | 'social' | 'print' | 'archive') => void;
  onCreateExport: () => void;
}) {
  const exportAssets = props.snapshot.assets.filter((asset) => asset.kind === 'export').slice(0, 4);
  const activeLabel = getExportLabel(props.activeRoute);

  return (
    <section className="panel-block">
      <div className="section-heading">
        <Download size={18} />
        <span>Exporty</span>
      </div>
      <p className="module-note">Aktivni workflow: {activeLabel}</p>
      <div className="control-grid">
        <label>
          Format
          <select
            value={props.exportFormat}
            onChange={(event) => props.onExportFormatChange(event.target.value as 'png' | 'jpg' | 'pdf' | 'html')}
          >
            <option value="png">png</option>
            <option value="jpg">jpg</option>
            <option value="pdf">pdf</option>
            <option value="html">html</option>
          </select>
        </label>
        <label>
          Pouziti
          <select
            value={props.exportUseCase}
            onChange={(event) => props.onExportUseCaseChange(event.target.value as 'web' | 'social' | 'print' | 'archive')}
          >
            <option value="web">web</option>
            <option value="social">social</option>
            <option value="print">print</option>
            <option value="archive">archive</option>
          </select>
        </label>
      </div>
      <button className="primary" onClick={props.onCreateExport} type="button">
        Vytvorit export
      </button>
      {exportAssets.length > 0 ? (
        <div className="result-stack">
          {exportAssets.map((asset: Asset) => (
            <div className="result-card" key={asset.id}>
              <strong>{asset.mimeType}</strong>
              <span className="export-path">{asset.storagePath}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getExportLabel(route: NanoRoute) {
  switch (route) {
    case 'mulen':
      return 'single image / before-after';
    case 'ai-upscaler':
      return '2K / 4K upscale';
    case 'face-swap':
      return 'comparison / final swap';
    case 'reframe':
      return 'reframe / camera pack';
    case 'variant-lab':
      return 'variant batch / compare';
    case 'visual-guide':
      return 'carousel / pdf / guide series';
    case 'infographic':
      return 'layout / pdf / html';
  }
}
