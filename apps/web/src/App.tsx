import { useEffect, useState } from 'react';
import { mockWorkspaceSnapshot, type WorkspaceSnapshot } from '@mulen/shared';
import { ModuleRail } from './components/project/moduleRail';
import { NanoHeader } from './components/project/NanoHeader';
import { ProjectWorkspace } from './components/project/ProjectWorkspace';
import type { NanoRoute } from './types/nano';
import { api, type ApiConfig } from './lib/api';

type AppTheme = 'light' | 'dark';

export function App() {
  const [activeRoute, setActiveRoute] = useState<NanoRoute>('mulen');
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(mockWorkspaceSnapshot);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = window.localStorage.getItem('mulen-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    window.localStorage.setItem('mulen-theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const [config, project] = await Promise.all([
          api.getConfig(),
          api.getProject(mockWorkspaceSnapshot.project.id),
        ]);

        if (!active) return;
        setApiConfig(config);
        setSnapshot(project);
        setLoadingError(null);
      } catch (error) {
        if (!active) return;
        setLoadingError(error instanceof Error ? error.message : 'Nepodarilo se nacist backend.');
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={theme === 'dark' ? 'app-shell app-shell-dark' : 'app-shell app-shell-light'}>
      <NanoHeader
        brand="Mulen Photo Director"
        theme={theme}
        onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
      />
      <div className="app-frame">
        <ModuleRail activeRoute={activeRoute} onSelectRoute={setActiveRoute} />
        <ProjectWorkspace
          activeRoute={activeRoute}
          snapshot={snapshot}
          theme={theme}
          apiConfig={apiConfig}
          loadingError={loadingError}
        />
      </div>
    </div>
  );
}
