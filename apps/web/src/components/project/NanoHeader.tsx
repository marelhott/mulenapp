import { Moon, Settings, Sun } from 'lucide-react';

type NanoHeaderProps = {
  brand?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

function NanoMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="2.4" fill="currentColor" />
      <circle cx="20" cy="9.5" r="1.7" fill="currentColor" />
      <circle cx="27.4" cy="12.6" r="1.6" fill="currentColor" opacity="0.95" />
      <circle cx="30.5" cy="20" r="1.5" fill="currentColor" opacity="0.9" />
      <circle cx="27.4" cy="27.4" r="1.6" fill="currentColor" opacity="0.95" />
      <circle cx="20" cy="30.5" r="1.7" fill="currentColor" />
      <circle cx="12.6" cy="27.4" r="1.6" fill="currentColor" opacity="0.95" />
      <circle cx="9.5" cy="20" r="1.5" fill="currentColor" opacity="0.9" />
      <circle cx="12.6" cy="12.6" r="1.6" fill="currentColor" opacity="0.95" />
      <circle cx="20" cy="5.8" r="1.05" fill="currentColor" opacity="0.55" />
      <circle cx="30" cy="10" r="1" fill="currentColor" opacity="0.45" />
      <circle cx="34.2" cy="20" r="0.95" fill="currentColor" opacity="0.4" />
      <circle cx="30" cy="30" r="1" fill="currentColor" opacity="0.45" />
      <circle cx="20" cy="34.2" r="1.05" fill="currentColor" opacity="0.55" />
      <circle cx="10" cy="30" r="1" fill="currentColor" opacity="0.45" />
      <circle cx="5.8" cy="20" r="0.95" fill="currentColor" opacity="0.4" />
      <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function NanoHeader(props: NanoHeaderProps) {
  return (
    <header className="nano-header">
      <div className="nano-header-brand">
        <div className="nano-header-mark">
          <NanoMark />
        </div>
        <div>
          <p>{props.brand ?? 'Mulen Nano'}</p>
        </div>
      </div>
      <div className="nano-header-actions">
        <button className="nano-theme-chip" type="button" onClick={props.onToggleTheme}>
          {props.theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          <span>{props.theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        <button className="nano-icon-button" type="button" aria-label="Settings">
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
