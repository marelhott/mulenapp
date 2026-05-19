import { Camera, ChartNoAxesCombined, Grid3X3, Layers3, ListTree, Maximize2, User } from 'lucide-react';
import type { NanoRoute } from '../../types/nano';

const ITEMS: Array<{
  id: NanoRoute;
  label: string;
  shortLabel: string;
  icon: typeof Grid3X3;
}> = [
  { id: 'mulen', label: 'Photo Director', shortLabel: 'Main', icon: Grid3X3 },
  { id: 'ai-upscaler', label: 'AI Upscaler', shortLabel: 'Scale', icon: Maximize2 },
  { id: 'face-swap', label: 'Face Swap', shortLabel: 'Face', icon: User },
  { id: 'reframe', label: 'Reframe', shortLabel: 'Frame', icon: Camera },
  { id: 'variant-lab', label: 'Variant Lab', shortLabel: 'Var', icon: Layers3 },
  { id: 'visual-guide', label: 'Visual Guide', shortLabel: 'Guide', icon: ListTree },
  { id: 'infographic', label: 'Infographic Generator', shortLabel: 'Info', icon: ChartNoAxesCombined },
];

export function ModuleRail(props: { activeRoute: NanoRoute; onSelectRoute: (route: NanoRoute) => void }) {
  return (
    <aside className="nano-rail" aria-label="Main navigation">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === props.activeRoute;

        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => props.onSelectRoute(item.id)}
            className={isActive ? 'nano-rail-item active' : 'nano-rail-item'}
          >
            <Icon size={13} strokeWidth={1.6} />
            <span>{item.shortLabel}</span>
            {isActive ? <i aria-hidden="true" /> : null}
          </button>
        );
      })}
    </aside>
  );
}
