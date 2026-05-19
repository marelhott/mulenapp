import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkspaceSnapshot } from '@mulen/shared';
import { mockWorkspaceSnapshot } from '@mulen/shared';
import { readMulenSnapshot, writeMulenSnapshot } from './mulenPersistence.js';

type ApiStore = {
  snapshot: WorkspaceSnapshot;
  updatedAt: string;
  mode: 'mock';
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = resolve(__dirname, '../.data/mock-store.json');

function createInitialStore(): ApiStore {
  return {
    snapshot: structuredClone(mockWorkspaceSnapshot),
    updatedAt: new Date().toISOString(),
    mode: 'mock',
  };
}

async function ensureStoreFile() {
  await mkdir(dirname(STORE_PATH), { recursive: true });

  try {
    await readFile(STORE_PATH, 'utf8');
  } catch {
    const initialStore = createInitialStore();
    await writeFile(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
  }
}

export async function readStore(): Promise<ApiStore> {
  await ensureStoreFile();
  const content = await readFile(STORE_PATH, 'utf8');
  const localStore = JSON.parse(content) as ApiStore;
  const remoteSnapshot = await readMulenSnapshot(localStore.snapshot.project.id);

  if (!remoteSnapshot) {
    return localStore;
  }

  return {
    ...localStore,
    snapshot: remoteSnapshot,
  };
}

export async function writeStore(store: ApiStore) {
  await ensureStoreFile();
  const normalizedStore = {
    ...store,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(
    STORE_PATH,
    JSON.stringify(normalizedStore, null, 2),
    'utf8',
  );

  await writeMulenSnapshot(normalizedStore.snapshot);
}

export async function updateStore(updater: (store: ApiStore) => ApiStore | Promise<ApiStore>) {
  const current = await readStore();
  const next = await updater(current);
  await writeStore(next);
  return next;
}

export async function resetStore() {
  const initialStore = createInitialStore();
  await writeStore(initialStore);
  return initialStore;
}
