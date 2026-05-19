import type { Asset, GenerationJob, MulenModule, WorkspaceSnapshot } from '@mulen/shared';

export type ApiConfig = {
  ok: boolean;
  mode: 'mock' | 'live';
  features: {
    inlineUpload: boolean;
    photoDirector: boolean;
    export: boolean;
    liveProviders: boolean;
    supabase: boolean;
    r2: boolean;
  };
  apiBaseUrl: string | null;
};

const API_BASE_URL = (import.meta.env.VITE_MULEN_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:4000';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export const api = {
  baseUrl: API_BASE_URL,
  getConfig() {
    return requestJson<ApiConfig>('/config');
  },
  getProject(projectId: string) {
    return requestJson<WorkspaceSnapshot>(`/projects/${projectId}`);
  },
  async inlineUpload(input: {
    projectId: string;
    kind: Asset['kind'];
    fileName: string;
    mimeType: string;
    dataUrl: string;
  }) {
    return requestJson<{ ok: true; asset: Asset; snapshot: WorkspaceSnapshot }>('/assets/inline-upload', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  createPhotoDirectorJob(input: {
    projectId: string;
    instruction: string;
    lockedText: string;
    outputCount: number;
    aspectRatio: 'original' | 'square' | 'portrait' | 'landscape';
    polishMode: 'focused' | 'balanced' | 'bold';
    sourceVersionId?: string;
  }) {
    return requestJson<GenerationJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        module: 'photo-director',
      }),
    });
  },
  createJob(input: {
    projectId: string;
    module: MulenModule;
    input: Record<string, unknown>;
  }) {
    return requestJson<GenerationJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  getJob(jobId: string) {
    return requestJson<GenerationJob & { runs?: unknown[] }>(`/jobs/${jobId}`);
  },
  createExport(input: {
    projectId: string;
    versionId?: string;
    format: 'png' | 'jpg' | 'pdf' | 'html';
    useCase: 'web' | 'social' | 'print' | 'archive';
    workflow?: string;
  }) {
    return requestJson<{ ok: true; snapshot: WorkspaceSnapshot }>('/exports', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export async function waitForJob(jobId: string, onProgress?: (job: GenerationJob) => void) {
  while (true) {
    const job = await api.getJob(jobId);
    onProgress?.(job);
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'partial' || job.status === 'cancelled') {
      return job;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 650));
  }
}
