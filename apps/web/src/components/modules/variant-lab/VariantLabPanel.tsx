import { Layers3 } from 'lucide-react';

const VARIANT_GROUPS = [
  'Nejvernejsi',
  'Nejlepsi pro reklamu',
  'Nejlepsi pro web',
  'Nejlepsi pro socialni site',
  'Nejodvaznejsi',
];

type VariantLabPanelProps = {
  count: number;
  intensity: 'jemne' | 'stredne' | 'odvazne';
  onCountChange: (value: number) => void;
  onIntensityChange: (value: 'jemne' | 'stredne' | 'odvazne') => void;
  onGenerateVariants: () => void;
  isGenerating: boolean;
};

export function VariantLabPanel(props: VariantLabPanelProps) {
  return (
    <section className="panel-block nano-module-panel">
      <div className="section-heading nano-module-heading">
        <Layers3 size={18} />
        <span>Variant Lab</span>
      </div>
      <p className="nano-module-kicker">Directed branching</p>
      <div className="control-grid">
        <label>
          Pocet
          <select value={String(props.count)} onChange={(event) => props.onCountChange(Number(event.target.value))}>
            <option>4</option>
            <option>8</option>
            <option>12</option>
            <option>20</option>
          </select>
        </label>
        <label>
          Intenzita
          <select
            value={props.intensity}
            onChange={(event) => props.onIntensityChange(event.target.value as 'jemne' | 'stredne' | 'odvazne')}
          >
            <option value="jemne">jemne</option>
            <option value="stredne">stredne</option>
            <option value="odvazne">odvazne</option>
          </select>
        </label>
      </div>
      <div className="variant-tags">
        {VARIANT_GROUPS.map((group) => (
          <span key={group}>{group}</span>
        ))}
      </div>
      <p className="module-note nano-module-note">Variant Lab pripravi rizene vetveni podle intenzity a poctu variant, ale porad vse uklada do jednoho projektu.</p>
      <div className="button-row nano-module-actions">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerateVariants}>
          {props.isGenerating ? 'Generuji batch...' : 'Spustit batch'}
        </button>
      </div>
    </section>
  );
}
