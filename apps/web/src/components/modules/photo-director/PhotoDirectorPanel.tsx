import { useState } from 'react';
import { ImagePlus, Wand2 } from 'lucide-react';

type PhotoDirectorPanelProps = {
  instruction: string;
  lockedText: string;
  outputCount: number;
  aspectRatio: 'original' | 'square' | 'portrait' | 'landscape';
  polishMode: 'focused' | 'balanced' | 'bold';
  onInstructionChange: (value: string) => void;
  onLockedTextChange: (value: string) => void;
  onUploadImage: (file: File) => void;
  onUploadReference: (file: File) => void;
  onOutputCountChange: (value: number) => void;
  onAspectRatioChange: (value: 'original' | 'square' | 'portrait' | 'landscape') => void;
  onPolishModeChange: (value: 'focused' | 'balanced' | 'bold') => void;
  onGenerate: () => void;
  onOpenVariantLab?: () => void;
  isGenerating: boolean;
};

export function PhotoDirectorPanel(props: PhotoDirectorPanelProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (fileList: FileList | File[], mode: 'source' | 'reference' = 'source') => {
    const file = Array.from(fileList).find((item) => item.type.startsWith('image/'));
    if (file) {
      if (mode === 'reference') props.onUploadReference(file);
      else props.onUploadImage(file);
    }
  };

  return (
    <section className="panel-block">
      <div className="section-heading">
        <Wand2 size={18} />
        <span>Photo Director</span>
      </div>
      <label>
        Vstupni fotka
        <div
          className={isDragging ? 'upload-slot dragging' : 'upload-slot'}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (event.dataTransfer.files) {
              processFile(event.dataTransfer.files);
            }
          }}
        >
          <input
            id="photo-director-upload"
            accept="image/*"
            className="upload-input"
            onChange={(event) => {
              if (event.target.files) {
                processFile(event.target.files, 'source');
              }
            }}
            type="file"
          />
          <ImagePlus size={18} />
          <span>Nahrat nebo pretahnout fotku</span>
        </div>
      </label>
      <input
        accept="image/*"
        className="upload-input hidden-upload-input"
        id="photo-director-reference-upload"
        onChange={(event) => {
          if (event.target.files) {
            processFile(event.target.files, 'reference');
          }
        }}
        title=""
        type="file"
      />
      <label>
        Co chces zlepsit?
        <textarea value={props.instruction} onChange={(event) => props.onInstructionChange(event.target.value)} />
      </label>
      <label>
        Co se nesmi zmenit?
        <input value={props.lockedText} onChange={(event) => props.onLockedTextChange(event.target.value)} />
      </label>
      <div className="control-grid">
        <label>
          Kolik navrhu
          <select value={String(props.outputCount)} onChange={(event) => props.onOutputCountChange(Number(event.target.value))}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
          </select>
        </label>
        <label>
          Format vystupu
          <select value={props.aspectRatio} onChange={(event) => props.onAspectRatioChange(event.target.value as PhotoDirectorPanelProps['aspectRatio'])}>
            <option value="original">Original</option>
            <option value="square">Square</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
      </div>
      <label>
        Mira zasahu
        <div className="segmented-control">
          {[
            { value: 'focused', label: 'Jen doladit' },
            { value: 'balanced', label: 'Vylepsit' },
            { value: 'bold', label: 'Premenit vic' },
          ].map((item) => (
            <button
              className={props.polishMode === item.value ? 'segment active' : 'segment'}
              key={item.value}
              onClick={() => props.onPolishModeChange(item.value as PhotoDirectorPanelProps['polishMode'])}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </label>
      <div className="button-row">
        <button className="primary" disabled={props.isGenerating} onClick={props.onGenerate}>
          {props.isGenerating ? 'Generuji...' : 'Jen doladit'}
        </button>
        <button disabled={props.isGenerating} onClick={props.onOpenVariantLab} type="button">
          Vytvorit varianty
        </button>
      </div>
    </section>
  );
}
