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
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 2H5C2.243 2 0 4.243 0 7V17C0 19.757 2.243 22 5 22H19C21.757 22 24 19.757 24 17V7C24 4.243 21.757 2 19 2ZM2 17V7C2 5.346 3.346 4 5 4H9V20H5C3.346 20 2 18.654 2 17ZM22 17C22 18.654 20.654 20 19 20H11V4H19C20.654 4 22 5.346 22 7V17ZM7 11C7 11.553 6.553 12 6 12H5C4.447 12 4 11.553 4 11C4 10.447 4.447 10 5 10H6C6.553 10 7 10.447 7 11ZM7 15C7 15.553 6.553 16 6 16H5C4.447 16 4 15.553 4 15C4 14.447 4.447 14 5 14H6C6.553 14 7 14.447 7 15ZM4 7C4 6.447 4.447 6 5 6H6C6.553 6 7 6.447 7 7C7 7.553 6.553 8 6 8H5C4.447 8 4 7.553 4 7Z" fill="currentColor" />
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
