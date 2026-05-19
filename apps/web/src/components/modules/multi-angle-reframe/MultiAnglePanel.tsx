import { Camera } from 'lucide-react';

const CAMERA_GROUPS = ['Hero', 'Detail', 'Context', 'Social', 'Banner', 'Close-up', 'Lifestyle', 'Wide'];

type MultiAnglePanelProps = {
  setType: 'produktova' | 'interier' | 'lifestyle' | 'social';
  shotCount: number;
  precision: 'bezpecna' | 'kreativni';
  onSetTypeChange: (value: 'produktova' | 'interier' | 'lifestyle' | 'social') => void;
  onShotCountChange: (value: number) => void;
  onPrecisionChange: (value: 'bezpecna' | 'kreativni') => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function MultiAnglePanel(props: MultiAnglePanelProps) {
  return (
    <section className="panel-block nano-module-panel">
      <div className="section-heading nano-module-heading">
        <Camera size={18} />
        <span>Multi-Angle Reframe</span>
      </div>
      <p className="nano-module-kicker">Camera set planning</p>
      <label>
        Typ sady
        <select
          value={props.setType}
          onChange={(event) =>
            props.onSetTypeChange(event.target.value as MultiAnglePanelProps['setType'])
          }
        >
          <option value="produktova">produktova sada</option>
          <option value="interier">interier</option>
          <option value="lifestyle">lifestyle</option>
          <option value="social">social media sada</option>
        </select>
      </label>
      <div className="control-grid">
        <label>
          Pocet zaberu
          <select value={String(props.shotCount)} onChange={(event) => props.onShotCountChange(Number(event.target.value))}>
            <option value="8">8</option>
            <option value="10">10</option>
            <option value="12">12</option>
            <option value="15">15</option>
          </select>
        </label>
        <label>
          Mira presnosti
          <select
            value={props.precision}
            onChange={(event) => props.onPrecisionChange(event.target.value as MultiAnglePanelProps['precision'])}
          >
            <option value="bezpecna">bezpecna</option>
            <option value="kreativni">kreativni</option>
          </select>
        </label>
      </div>
      <div className="variant-tags">
        {CAMERA_GROUPS.map((group) => (
          <span key={group}>{group}</span>
        ))}
      </div>
      <p className="module-note nano-module-note">
        Nektere uhly jsou AI interpretace, ne presna dokumentace reality. Mulen se snazi drzet objekt, materialy a styl.
      </p>
      <div className="button-row nano-module-actions">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate} type="button">
          {props.isGenerating ? 'Generuji set...' : 'Vytvorit camera set'}
        </button>
      </div>
    </section>
  );
}
