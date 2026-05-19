import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

const intervalMs = Number(process.env.WORKER_POLL_MS || 3000);
const apiBaseUrl = (process.env.MULEN_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export {};

async function runLoop() {
  const response = await fetch(`${apiBaseUrl}/internal/process-queued`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Worker failed to process queue: ${response.status} ${response.statusText}`);
  }
}

if (process.env.RUN_ONCE === '1') {
  await runLoop();
  console.log('Mulen worker processed queued jobs once.');
} else {
  console.log(`Mulen worker polling ${apiBaseUrl} every ${intervalMs}ms.`);
  await runLoop().catch((error) => {
    console.error(error);
  });
  setInterval(() => {
    void runLoop().catch((error) => {
      console.error(error);
    });
  }, intervalMs);
}
