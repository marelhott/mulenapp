import { Brush } from 'lucide-react';

type StyleTransferPanelProps = {
  prompt: string;
  preserveComposition: boolean;
  onPromptChange: (value: string) => void;
  onPreserveCompositionChange: (value: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function StyleTransferPanel(props: StyleTransferPanelProps) {
  return (
    <section className="panel-block nano-module-panel">
      <div className="section-heading nano-module-heading">
        <Brush size={18} />
        <span>Style Transfer</span>
      </div>
      <p className="nano-module-kicker">Reference direction</p>
      <label>
        Styl nebo reference smer
        <textarea
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder="Treba: premium editorial daylight, jemnejsi textury, zachovat tvar produktu."
        />
      </label>
      <label className="toggle-row">
        <input
          checked={props.preserveComposition}
          onChange={(event) => props.onPreserveCompositionChange(event.target.checked)}
          type="checkbox"
        />
        <span>Zachovat kompozici co nejvic</span>
      </label>
      <p className="module-note nano-module-note">Style transfer uklada vysledek jako dalsi branch, aby se dalo pokracovat bez restartu celeho smeru.</p>
      <div className="button-row nano-module-actions">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Prenasim styl...' : 'Aplikovat style transfer'}
        </button>
      </div>
    </section>
  );
}
