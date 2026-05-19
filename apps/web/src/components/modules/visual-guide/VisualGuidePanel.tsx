import { ListTree } from 'lucide-react';

type VisualGuidePanelProps = {
  prompt: string;
  stepCount: number;
  style: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial';
  output: 'carousel' | 'pdf' | 'blog' | 'web';
  onPromptChange: (value: string) => void;
  onStepCountChange: (value: number) => void;
  onStyleChange: (value: 'fotorealisticky' | 'edukativni' | 'technicky' | 'editorial') => void;
  onOutputChange: (value: 'carousel' | 'pdf' | 'blog' | 'web') => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function VisualGuidePanel(props: VisualGuidePanelProps) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <ListTree size={18} />
        <span>Visual Guide</span>
      </div>
      <label>
        Jedna veta dovnitr
        <textarea
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder="Treba: udelej mi navod jak uvarit pho"
        />
      </label>
      <div className="control-grid">
        <label>
          Pocet kroku
          <select value={String(props.stepCount)} onChange={(event) => props.onStepCountChange(Number(event.target.value))}>
            <option value="5">5</option>
            <option value="8">8</option>
            <option value="10">10</option>
          </select>
        </label>
        <label>
          Styl
          <select value={props.style} onChange={(event) => props.onStyleChange(event.target.value as VisualGuidePanelProps['style'])}>
            <option value="fotorealisticky">fotorealisticky</option>
            <option value="edukativni">edukativni</option>
            <option value="technicky">technicky</option>
            <option value="editorial">editorial</option>
          </select>
        </label>
      </div>
      <label>
        Vystup
        <select value={props.output} onChange={(event) => props.onOutputChange(event.target.value as VisualGuidePanelProps['output'])}>
          <option value="carousel">carousel</option>
          <option value="pdf">pdf</option>
          <option value="blog">blog obrazky</option>
          <option value="web">web sekce</option>
        </select>
      </label>
      <div className="variant-tags">
        <span>anchor frame</span>
        <span>recurring objects</span>
        <span>captions</span>
        <span>step consistency</span>
      </div>
      <div className="button-row">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Generuji guide...' : 'Vytvorit navod'}
        </button>
      </div>
    </section>
  );
}
