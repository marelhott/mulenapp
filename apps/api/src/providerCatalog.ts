import type { PhotoDirectorProviderKey } from './photoDirectorInternals.js';

export type ProviderCatalogItem = {
  id: PhotoDirectorProviderKey | 'grok' | 'replicate';
  name: string;
  icon: string;
  description: string;
  live: boolean;
  supportsGrounding: boolean;
  maxImages: number;
  defaultMode: 'fast' | 'balanced' | 'quality';
  modes: Array<{
    id: 'fast' | 'balanced' | 'quality';
    label: string;
    description: string;
  }>;
  models: Array<{
    id: string;
    label: string;
    category: 'image' | 'edit' | 'compare';
  }>;
};

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    icon: 'gemini',
    description: 'Best for flexible text-plus-image direction, references and grounded edits.',
    live: true,
    supportsGrounding: true,
    maxImages: 10,
    defaultMode: 'balanced',
    modes: [
      { id: 'fast', label: 'Fast', description: 'Lighter, quicker iterations for broad exploration.' },
      { id: 'balanced', label: 'Balanced', description: 'Best default for most Photo Director edits.' },
      { id: 'quality', label: 'Quality', description: 'More deliberate, reference-aware rendering.' },
    ],
    models: [
      { id: 'gemini-flash', label: 'Nano 2', category: 'image' },
      { id: 'gemini-pro', label: 'Nano Pro', category: 'image' },
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: 'chatgpt',
    description: 'Strong single-image clean renders and dependable prompt following.',
    live: true,
    supportsGrounding: false,
    maxImages: 1,
    defaultMode: 'quality',
    modes: [
      { id: 'fast', label: 'Fast', description: 'Quicker draft render with lighter quality constraints.' },
      { id: 'balanced', label: 'Balanced', description: 'Stable edit mode with standard polish.' },
      { id: 'quality', label: 'Quality', description: 'Highest quality pass for one focused output.' },
    ],
    models: [
      { id: 'openai-image', label: 'GPT Img 2', category: 'image' },
    ],
  },
  {
    id: 'flux_pro',
    name: 'FLUX Pro',
    icon: 'flux',
    description: 'Commercial-quality direct render suited for polished hero outputs.',
    live: true,
    supportsGrounding: false,
    maxImages: 4,
    defaultMode: 'quality',
    modes: [
      { id: 'fast', label: 'Fast', description: 'Looser render prioritizing turnaround speed.' },
      { id: 'balanced', label: 'Balanced', description: 'Good mix of structure and atmosphere.' },
      { id: 'quality', label: 'Quality', description: 'Best finish for polished marketing imagery.' },
    ],
    models: [
      { id: 'flux-pro', label: 'Flux Pro', category: 'image' },
    ],
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: 'grok',
    description: 'Prepared shell for future multimodal experiments and comparison runs.',
    live: false,
    supportsGrounding: false,
    maxImages: 1,
    defaultMode: 'balanced',
    modes: [
      { id: 'fast', label: 'Fast', description: 'Reserved for lightweight future test runs.' },
      { id: 'balanced', label: 'Balanced', description: 'Default comparison mode once enabled.' },
      { id: 'quality', label: 'Quality', description: 'Reserved for highest-quality comparison mode.' },
    ],
    models: [],
  },
  {
    id: 'replicate',
    name: 'Replicate',
    icon: 'replicate',
    description: 'Prepared shell for specialist third-party models and experiments.',
    live: false,
    supportsGrounding: false,
    maxImages: 8,
    defaultMode: 'balanced',
    modes: [
      { id: 'fast', label: 'Fast', description: 'For lightweight experimental model runs.' },
      { id: 'balanced', label: 'Balanced', description: 'Default mode for future Replicate routing.' },
      { id: 'quality', label: 'Quality', description: 'Reserved for heavier premium model passes.' },
    ],
    models: [],
  },
];
