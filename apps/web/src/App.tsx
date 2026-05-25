import { useEffect, useState } from 'react';
import { mockWorkspaceSnapshot, type WorkspaceSnapshot } from '@mulen/shared';
import { ModuleRail } from './components/project/moduleRail';
import { ProjectWorkspace } from './components/project/ProjectWorkspace';
import type { NanoRoute } from './types/nano';
import { api, type ApiConfig } from './lib/api';

type AppTheme = 'light' | 'dark';

export function App() {
  const [activeRoute, setActiveRoute] = useState<NanoRoute>('mulen');
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(mockWorkspaceSnapshot);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isRailCollapsed, setIsRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('mulen-rail-collapsed') === 'true';
  });
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = window.localStorage.getItem('mulen-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    window.localStorage.setItem('mulen-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('mulen-rail-collapsed', String(isRailCollapsed));
  }, [isRailCollapsed]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      let configError: string | null = null;

      // Load config independently so apiConfig is always set even if project load fails
      try {
        const config = await api.getConfig();
        if (active) setApiConfig(config);
      } catch (error) {
        configError = error instanceof Error ? error.message : 'Nepodarilo se nacist konfiguraci backendu.';
      }

      try {
        const project = await api.getProject(mockWorkspaceSnapshot.project.id);
        if (!active) return;
        setSnapshot(project);
        setLoadingError(configError);
      } catch (error) {
        if (!active) return;
        const projectError = error instanceof Error ? error.message : 'Nepodarilo se nacist projekt.';
        setLoadingError(configError ?? projectError);
      }
    }

    void loadWorkspace();

    // Retry every 3 seconds until apiConfig is loaded (handles API server starting after page load)
    const retryInterval = window.setInterval(async () => {
      if (!active) return;
      try {
        const config = await api.getConfig();
        if (active) {
          setApiConfig(config);
          setLoadingError(null);
          window.clearInterval(retryInterval);
          // Also reload project snapshot on successful reconnect
          try {
            const project = await api.getProject(mockWorkspaceSnapshot.project.id);
            if (active) setSnapshot(project);
          } catch {
            // project load failure is non-critical
          }
        }
      } catch {
        // still offline, keep retrying
      }
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(retryInterval);
    };
  }, []);

  return (
    <div className={theme === 'dark' ? 'app-shell app-shell-dark' : 'app-shell app-shell-light'}>
      <div className={isRailCollapsed ? 'app-frame sidebar-collapsed' : 'app-frame'}>
        <ModuleRail activeRoute={activeRoute} onSelectRoute={setActiveRoute} collapsed={isRailCollapsed} onToggleCollapsed={() => setIsRailCollapsed((current) => !current)} />
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
