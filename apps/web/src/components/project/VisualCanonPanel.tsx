import { Camera } from 'lucide-react';
import type { WorkspaceSnapshot } from '@mulen/shared';

export function VisualCanonPanelSection({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  return (
    <section className="panel-block compact">
      <div className="section-heading">
        <Camera size={18} />
        <span>Visual Canon</span>
      </div>
      <p>{snapshot.visualCanon.styleSummary}</p>
      <div className="canon-list">
        {snapshot.visualCanon.doNotChange.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </section>
  );
}
