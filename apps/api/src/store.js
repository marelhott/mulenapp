import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockWorkspaceSnapshot } from '@mulen/shared';
const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = resolve(__dirname, '../.data/mock-store.json');
function createInitialStore() {
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
    }
    catch {
        const initialStore = createInitialStore();
        await writeFile(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    }
}
export async function readStore() {
    await ensureStoreFile();
    const content = await readFile(STORE_PATH, 'utf8');
    return JSON.parse(content);
}
export async function writeStore(store) {
    await ensureStoreFile();
    await writeFile(STORE_PATH, JSON.stringify({
        ...store,
        updatedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
}
export async function updateStore(updater) {
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
