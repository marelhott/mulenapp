import { Camera, ChartNoAxesCombined, Grid3X3, Layers3, ListTree, Maximize2, User } from 'lucide-react';
import type { NanoRoute } from '../../types/nano';
import { RailHoverInfo } from './RailHoverInfo';
import { RAIL_INFO } from './railInfo';

const ITEMS: Array<{
  id: NanoRoute;
  label: string;
  icon: typeof Grid3X3;
}> = [
  { id: 'mulen', label: 'Photo Director', icon: Grid3X3 },
  { id: 'ai-upscaler', label: 'AI Upscaler', icon: Maximize2 },
  { id: 'face-swap', label: 'Face Swap', icon: User },
  { id: 'reframe', label: 'Reframe', icon: Camera },
  { id: 'variant-lab', label: 'Variant Lab', icon: Layers3 },
  { id: 'visual-guide', label: 'Visual Guide', icon: ListTree },
  { id: 'infographic', label: 'Infographic Generator', icon: ChartNoAxesCombined },
];

export function ModuleRail(props: {
  activeRoute: NanoRoute;
  onSelectRoute: (route: NanoRoute) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside className={props.collapsed ? 'sidebar-nav collapsed' : 'sidebar-nav'} aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">M</div>
          <span className="sidebar-logo-text">Mulen</span>
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={props.onToggleCollapsed}
            aria-label={props.collapsed ? 'Rozbalit navigaci' : 'Sbalit navigaci'}
            aria-pressed={props.collapsed}
          >
            <svg width="33" height="33" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="4.5" stroke="currentColor" strokeWidth="1.75" />
              <path d="M11 5.3v13.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M7.25 9.25v5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <path d={props.collapsed ? 'm15.5 12-2.6-2.35v4.7L15.5 12Z' : 'm12.5 12 2.6-2.35v4.7L12.5 12Z'} fill="currentColor" stroke="currentColor" strokeWidth="0.2" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="sidebar-menu">
        <div className="sidebar-section">
          <div className="sidebar-section-title">My Tools</div>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === props.activeRoute;
            const info = RAIL_INFO[item.id];

            return (
              <div className="sidebar-menu-item-wrap" key={item.id}>
                <button
                  type="button"
                  onClick={() => props.onSelectRoute(item.id)}
                  className={isActive ? 'sidebar-menu-item active' : 'sidebar-menu-item'}
                  title={props.collapsed ? item.label : undefined}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
                <RailHoverInfo info={info} />
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
