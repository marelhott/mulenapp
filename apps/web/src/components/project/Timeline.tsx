import { Box, GitBranch } from 'lucide-react';
import type { ImageVersion, WorkspaceSnapshot } from '@mulen/shared';

export function TimelinePanel(props: {
  snapshot: WorkspaceSnapshot;
  onSelectVersion?: (versionId: string) => void;
  onResetToActive?: () => void;
  onContinueFromActive?: () => void;
}) {
  const orderedVersions = [...props.snapshot.versions].sort((a, b) => {
    const depthDiff = getDepth(props.snapshot.versions, a) - getDepth(props.snapshot.versions, b);
    if (depthDiff !== 0) return depthDiff;
    return a.createdAt < b.createdAt ? -1 : 1;
  });

  return (
    <footer className="timeline">
      <div className="section-heading">
        <GitBranch size={18} />
        <span>Version tree / timeline</span>
      </div>
      <div className="timeline-items">
        {orderedVersions.map((version) => (
          <button
            className={version.id === props.snapshot.project.activeVersionId ? 'timeline-item active' : 'timeline-item'}
            key={version.id}
            onClick={() => props.onSelectVersion?.(version.id)}
            style={{ paddingLeft: `${12 + getDepth(props.snapshot.versions, version) * 18}px` }}
          >
            <Box size={16} />
            <span>{version.label}</span>
            <small>{version.module}</small>
          </button>
        ))}
      </div>
      <div className="timeline-actions">
        <button onClick={props.onResetToActive} type="button">
          Vratit se k teto verzi
        </button>
        <button className="primary" onClick={props.onContinueFromActive} type="button">
          Pokracovat timto smerem
        </button>
      </div>
    </footer>
  );
}

function getDepth(versions: ImageVersion[], version: ImageVersion) {
  let depth = 0;
  let cursor = version.parentVersionId;

  while (cursor) {
    depth += 1;
    cursor = versions.find((item) => item.id === cursor)?.parentVersionId;
  }

  return depth;
}
