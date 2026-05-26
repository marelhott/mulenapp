import type { PhotoDirectorProviderKey } from './photoDirectorInternals.js';

export type ProviderCatalogItem = {
  id: PhotoDirectorProviderKey | 'grok' | 'replicate';
  name: string;
  icon: string;
  supportsGrounding: boolean;
  maxImages: number;
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
    supportsGrounding: true,
    maxImages: 10,
    models: [
      { id: 'gemini-flash', label: 'Nano 2', category: 'image' },
      { id: 'gemini-pro', label: 'Nano Pro', category: 'image' },
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: 'chatgpt',
    supportsGrounding: false,
    maxImages: 1,
    models: [
      { id: 'openai-image', label: 'GPT Img 2', category: 'image' },
    ],
  },
  {
    id: 'flux_pro',
    name: 'FLUX Pro',
    icon: 'flux',
    supportsGrounding: false,
    maxImages: 4,
    models: [
      { id: 'flux-pro', label: 'Flux Pro', category: 'image' },
    ],
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: 'grok',
    supportsGrounding: false,
    maxImages: 1,
    models: [],
  },
  {
    id: 'replicate',
    name: 'Replicate',
    icon: 'replicate',
    supportsGrounding: false,
    maxImages: 8,
    models: [],
  },
];
