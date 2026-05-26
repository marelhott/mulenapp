import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SavedPromptRecord = {
  id: string;
  name: string;
  prompt: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionRecord = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
};

type LibraryStore = {
  savedPrompts: SavedPromptRecord[];
  collections: CollectionRecord[];
  updatedAt: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = resolve(__dirname, '../.data/library-store.json');

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialStore(): LibraryStore {
  return {
    savedPrompts: [],
    collections: [],
    updatedAt: new Date().toISOString(),
  };
}

async function ensureStoreFile() {
  await mkdir(dirname(STORE_PATH), { recursive: true });

  try {
    await readFile(STORE_PATH, 'utf8');
  } catch {
    await writeFile(STORE_PATH, JSON.stringify(createInitialStore(), null, 2), 'utf8');
  }
}

async function readLibraryStore(): Promise<LibraryStore> {
  await ensureStoreFile();
  const content = await readFile(STORE_PATH, 'utf8');
  return JSON.parse(content) as LibraryStore;
}

async function writeLibraryStore(store: LibraryStore) {
  await ensureStoreFile();
  await writeFile(
    STORE_PATH,
    JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

export async function listSavedPromptsStore() {
  const store = await readLibraryStore();
  return store.savedPrompts.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function upsertSavedPromptStore(input: {
  id?: string;
  name: string;
  prompt: string;
  category?: string;
}) {
  const store = await readLibraryStore();
  const now = new Date().toISOString();
  const id = input.id || createId('prompt');
  const existingIndex = store.savedPrompts.findIndex((item) => item.id === id);

  const nextRecord: SavedPromptRecord = {
    id,
    name: input.name.trim(),
    prompt: input.prompt,
    category: input.category,
    createdAt: existingIndex >= 0 ? store.savedPrompts[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) store.savedPrompts[existingIndex] = nextRecord;
  else store.savedPrompts.unshift(nextRecord);

  await writeLibraryStore(store);
  return nextRecord;
}

export async function deleteSavedPromptStore(id: string) {
  const store = await readLibraryStore();
  store.savedPrompts = store.savedPrompts.filter((item) => item.id !== id);
  await writeLibraryStore(store);
}

export async function listCollectionsStore() {
  const store = await readLibraryStore();
  return store.collections.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function upsertCollectionStore(input: {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  imageIds?: string[];
}) {
  const store = await readLibraryStore();
  const now = new Date().toISOString();
  const id = input.id || createId('collection');
  const existingIndex = store.collections.findIndex((item) => item.id === id);

  const previous = existingIndex >= 0 ? store.collections[existingIndex] : undefined;
  const nextRecord: CollectionRecord = {
    id,
    name: input.name.trim(),
    description: input.description,
    color: input.color,
    imageIds: Array.from(new Set(input.imageIds ?? previous?.imageIds ?? [])),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };

  if (existingIndex >= 0) store.collections[existingIndex] = nextRecord;
  else store.collections.unshift(nextRecord);

  await writeLibraryStore(store);
  return nextRecord;
}

export async function deleteCollectionStore(id: string) {
  const store = await readLibraryStore();
  store.collections = store.collections.filter((item) => item.id !== id);
  await writeLibraryStore(store);
}
