export type PhotoDirectorProviderKey = 'gemini' | 'chatgpt' | 'flux_pro';

const GEMINI_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '5:4', '4:5', '9:16', '16:9', '21:9'];
const FLUX_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:21', '21:9'];
const GEMINI_RETRY_BASE_BACKOFF_MS = 12_000;
const DEFAULT_RETRY_BASE_BACKOFF_MS = 6_000;
const DEFAULT_BATCH_CHUNK_SIZE = 5;

function ratioToFloat(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return 1;
  return w / h;
}

function findClosestRatio(target: number, available: string[]): { ratio: string; exact: boolean } {
  let closest = available[0] ?? '1:1';
  let minDiff = Infinity;

  for (const ratio of available) {
    const diff = Math.abs(ratioToFloat(ratio) - target);
    if (diff < 0.01) return { ratio, exact: true };
    if (diff < minDiff) {
      minDiff = diff;
      closest = ratio;
    }
  }

  return { ratio: closest, exact: false };
}

function normalizeRequestedAspectRatio(value?: unknown): string {
  const raw = String(value || 'square').trim();
  const normalized = raw.toLowerCase();

  if (!raw || normalized === 'original' || normalized === 'square') return '1:1';
  if (normalized === 'portrait') return '3:4';
  if (normalized === 'landscape') return '4:3';
  if (/^\d+:\d+$/.test(raw)) return raw;
  return '1:1';
}

export function chunkBatchItems<T>(items: T[], chunkSize = DEFAULT_BATCH_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function isRetriableProviderError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('toomanyrequests') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted') ||
    message.includes('request blocked') ||
    message.includes('503') ||
    message.includes('temporarily unavailable') ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('overloaded')
  );
}

export function getRetryBackoffMs(provider: PhotoDirectorProviderKey, retryCount: number): number {
  const baseDelay = provider === 'gemini' ? GEMINI_RETRY_BASE_BACKOFF_MS : DEFAULT_RETRY_BASE_BACKOFF_MS;
  return baseDelay * Math.pow(2, retryCount - 1);
}

export function mapAspectRatioForProvider(
  requestedRatio: unknown,
  provider: PhotoDirectorProviderKey,
): { value: string; original: string; exact: boolean; warning?: string } {
  const original = normalizeRequestedAspectRatio(requestedRatio);

  if (provider === 'gemini') {
    if (GEMINI_RATIOS.includes(original)) {
      return { value: original, original, exact: true };
    }
    const { ratio, exact } = findClosestRatio(ratioToFloat(original), GEMINI_RATIOS);
    return {
      value: ratio,
      original,
      exact,
      warning: exact ? undefined : `Gemini maps ${original} to ${ratio}.`,
    };
  }

  if (provider === 'chatgpt') {
    const aspect = ratioToFloat(original);
    if (aspect > 1.2) {
      return {
        value: '4:3',
        original,
        exact: original === '4:3' || original === '3:2',
        warning: original === '4:3' || original === '3:2' ? undefined : `OpenAI maps ${original} to a landscape size.`,
      };
    }
    if (aspect < 0.83) {
      return {
        value: '3:4',
        original,
        exact: original === '3:4' || original === '2:3',
        warning: original === '3:4' || original === '2:3' ? undefined : `OpenAI maps ${original} to a portrait size.`,
      };
    }
    return {
      value: '1:1',
      original,
      exact: original === '1:1',
      warning: original === '1:1' ? undefined : `OpenAI maps ${original} to square.`,
    };
  }

  if (FLUX_RATIOS.includes(original)) {
    return { value: original, original, exact: true };
  }

  const { ratio, exact } = findClosestRatio(ratioToFloat(original), FLUX_RATIOS);
  return {
    value: ratio,
    original,
    exact,
    warning: exact ? undefined : `FLUX maps ${original} to ${ratio}.`,
  };
}
