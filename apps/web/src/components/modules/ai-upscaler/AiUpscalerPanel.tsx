import { Maximize2 } from 'lucide-react';

type AiUpscalerPanelProps = {
  scale: '2k' | '4k';
  focus: 'full' | 'face' | 'product';
  onScaleChange: (value: '2k' | '4k') => void;
  onFocusChange: (value: 'full' | 'face' | 'product') => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function AiUpscalerPanel(props: AiUpscalerPanelProps) {
  return (
    <section className="panel-block nano-module-panel">
      <div className="section-heading nano-module-heading">
        <Maximize2 size={18} />
        <span>AI Upscaler</span>
      </div>
      <p className="nano-module-kicker">Resolution workflow</p>
      <div className="control-grid">
        <label>
          Rozliseni
          <select value={props.scale} onChange={(event) => props.onScaleChange(event.target.value as AiUpscalerPanelProps['scale'])}>
            <option value="2k">2K</option>
            <option value="4k">4K</option>
          </select>
        </label>
        <label>
          Fokus
          <select value={props.focus} onChange={(event) => props.onFocusChange(event.target.value as AiUpscalerPanelProps['focus'])}>
            <option value="full">cely obraz</option>
            <option value="face">oblicej</option>
            <option value="product">produkt</option>
          </select>
        </label>
      </div>
      <p className="module-note nano-module-note">Upscale vytvori novou verzi v historii projektu, aby se dalo vratit zpet a pokracovat dal.</p>
      <div className="button-row nano-module-actions">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Upscaluji...' : 'Upscalovat'}
        </button>
      </div>
    </section>
  );
}
