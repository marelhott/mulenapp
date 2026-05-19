import type { MulenModule } from '@mulen/shared';

export type NanoRoute =
  | 'mulen'
  | 'ai-upscaler'
  | 'face-swap'
  | 'reframe'
  | 'variant-lab'
  | 'visual-guide'
  | 'infographic';

export const NANO_ROUTES: NanoRoute[] = [
  'mulen',
  'ai-upscaler',
  'face-swap',
  'reframe',
  'variant-lab',
  'visual-guide',
  'infographic',
];

export function mapNanoRouteToModule(route: NanoRoute): MulenModule {
  switch (route) {
    case 'mulen':
    case 'ai-upscaler':
      return 'photo-director';
    case 'face-swap':
      return 'headswap';
    case 'reframe':
      return 'multi-angle-reframe';
    case 'variant-lab':
      return 'variant-lab';
    case 'visual-guide':
      return 'visual-guide';
    case 'infographic':
      return 'infographic-generator';
  }
}

export function getNanoRouteLabel(route: NanoRoute) {
  switch (route) {
    case 'mulen':
      return 'Photo Director';
    case 'ai-upscaler':
      return 'AI Upscaler';
    case 'face-swap':
      return 'Face Swap';
    case 'reframe':
      return 'Reframe';
    case 'variant-lab':
      return 'Variant Lab';
    case 'visual-guide':
      return 'Visual Guide';
    case 'infographic':
      return 'Infographic Generator';
  }
}
