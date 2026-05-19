import { ChartNoAxesCombined } from 'lucide-react';

type InfographicPanelProps = {
  topic: string;
  type: 'edukacni' | 'srovnavaci' | 'procesni' | 'business';
  format: 'A4' | 'square' | 'story' | 'wide';
  theme: 'light' | 'dark';
  onTopicChange: (value: string) => void;
  onTypeChange: (value: 'edukacni' | 'srovnavaci' | 'procesni' | 'business') => void;
  onFormatChange: (value: 'A4' | 'square' | 'story' | 'wide') => void;
  onThemeChange: (value: 'light' | 'dark') => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function InfographicPanel(props: InfographicPanelProps) {
  return (
    <section className="panel-block">
      <div className="section-heading">
        <ChartNoAxesCombined size={18} />
        <span>Infographic Generator</span>
      </div>
      <label>
        Tema nebo vstupni text
        <textarea
          value={props.topic}
          onChange={(event) => props.onTopicChange(event.target.value)}
          placeholder="Treba: rozdil mezi B2B lead gen a brand kampani"
        />
      </label>
      <div className="control-grid">
        <label>
          Typ
          <select value={props.type} onChange={(event) => props.onTypeChange(event.target.value as InfographicPanelProps['type'])}>
            <option value="edukacni">edukacni</option>
            <option value="srovnavaci">srovnavaci</option>
            <option value="procesni">procesni</option>
            <option value="business">business</option>
          </select>
        </label>
        <label>
          Format
          <select value={props.format} onChange={(event) => props.onFormatChange(event.target.value as InfographicPanelProps['format'])}>
            <option value="A4">A4</option>
            <option value="square">square</option>
            <option value="story">story</option>
            <option value="wide">wide</option>
          </select>
        </label>
      </div>
      <label>
        Tema vzhledu
        <div className="segmented-control two-up">
          <button className={props.theme === 'light' ? 'segment active' : 'segment'} onClick={() => props.onThemeChange('light')} type="button">
            Light
          </button>
          <button className={props.theme === 'dark' ? 'segment active' : 'segment'} onClick={() => props.onThemeChange('dark')} type="button">
            Dark
          </button>
        </div>
      </label>
      <p className="module-note">
        Tady renderujeme skutecny text a layout. Ne rozbite napisy z image modelu.
      </p>
      <div className="button-row">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Skladam infographic...' : 'Vytvorit infographic'}
        </button>
      </div>
    </section>
  );
}
