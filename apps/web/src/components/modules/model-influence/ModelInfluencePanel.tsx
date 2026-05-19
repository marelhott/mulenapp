import { Layers } from 'lucide-react';

type ModelInfluencePanelProps = {
  prompt: string;
  strength: 'low' | 'medium' | 'high';
  onPromptChange: (value: string) => void;
  onStrengthChange: (value: 'low' | 'medium' | 'high') => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function ModelInfluencePanel(props: ModelInfluencePanelProps) {
  return (
    <section className="panel-block nano-module-panel">
      <div className="section-heading nano-module-heading">
        <Layers size={18} />
        <span>Model Influence</span>
      </div>
      <p className="nano-module-kicker">Prompt weighting</p>
      <label>
        Smer vlivu
        <textarea
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder="Popis, jak ma model vic ovlivnit svetlo, material, fotograficky feeling nebo render kvalitu."
        />
      </label>
      <label>
        Sila vlivu
        <div className="segmented-control">
          {[
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={props.strength === value ? 'segment active' : 'segment'}
              onClick={() => props.onStrengthChange(value as ModelInfluencePanelProps['strength'])}
            >
              {label}
            </button>
          ))}
        </div>
      </label>
      <p className="module-note nano-module-note">Tady ridis, jak silne ma system zasahnout do materialu, svetla a celkoveho dojmu finalniho vystupu.</p>
      <div className="button-row nano-module-actions">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Generuji...' : 'Vytvorit influenced variants'}
        </button>
      </div>
    </section>
  );
}
