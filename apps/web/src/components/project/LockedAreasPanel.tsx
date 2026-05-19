import { Lock } from 'lucide-react';
import type { WorkspaceSnapshot } from '@mulen/shared';

export function LockedAreasPanelSection({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  return (
    <section className="panel-block compact">
      <div className="section-heading">
        <Lock size={18} />
        <span>Zamcene oblasti</span>
      </div>
      {snapshot.lockedAreas.map((area) => (
        <div className="info-row" key={area.id}>
          <strong>{area.label}</strong>
          <span>{area.strictness}</span>
        </div>
      ))}
    </section>
  );
}
