import type { NanoRoute } from '../../types/nano';

export type RailInfo = {
  eyebrow: string;
  title: string;
  shortLabel: string;
  description: string;
  bullets: string[];
  previews: Array<{
    caption: string;
    imageUrl: string;
  }>;
};

export const RAIL_INFO: Record<NanoRoute, RailInfo> = {
  mulen: {
    eyebrow: 'Core Module',
    title: 'Photo Director',
    shortLabel: 'Main',
    description: 'AI-powered photo editing with precise control over composition, lighting, and style.',
    bullets: [
      'Preserve product identity and composition',
      'Advanced locked area support',
      'Visual canon consistency',
      'Multiple generation modes',
    ],
    previews: [
      {
        caption: 'Original',
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop',
      },
      {
        caption: 'Enhanced',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop',
      },
    ],
  },
  'ai-upscaler': {
    eyebrow: 'Enhancement',
    title: 'AI Upscaler',
    shortLabel: 'Scale',
    description: 'Upscale images while preserving quality and details using advanced AI models.',
    bullets: [
      'Up to 4x resolution increase',
      'Detail preservation',
      'Artifact removal',
      'Batch processing support',
    ],
    previews: [
      {
        caption: 'Low Res',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop',
      },
      {
        caption: 'Upscaled',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
      },
    ],
  },
  'face-swap': {
    eyebrow: 'Identity',
    title: 'Face Swap',
    shortLabel: 'Face',
    description: 'Swap faces while maintaining natural expressions and lighting.',
    bullets: [
      'Expression preservation',
      'Lighting adaptation',
      'High-quality blending',
      'Multiple face support',
    ],
    previews: [
      {
        caption: 'Source',
        imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
      },
      {
        caption: 'Swapped',
        imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=300&fit=crop',
      },
    ],
  },
  reframe: {
    eyebrow: 'Perspective',
    title: 'Multi-Angle Reframe',
    shortLabel: 'Frame',
    description: 'Generate multiple camera angles and perspectives from a single image.',
    bullets: [
      'Dynamic angle generation',
      'Perspective control',
      'Composition variants',
      'Professional framing',
    ],
    previews: [
      {
        caption: 'Front',
        imageUrl: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=300&fit=crop',
      },
      {
        caption: 'Angle',
        imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=300&fit=crop',
      },
    ],
  },
  'variant-lab': {
    eyebrow: 'Exploration',
    title: 'Variant Lab',
    shortLabel: 'Var',
    description: 'Generate multiple creative variations while maintaining brand consistency.',
    bullets: [
      'Creative exploration',
      'Style consistency',
      'Batch generation',
      'Quality scoring',
    ],
    previews: [
      {
        caption: 'Variant A',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
      },
      {
        caption: 'Variant B',
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop',
      },
      {
        caption: 'Variant C',
        imageUrl: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=300&h=300&fit=crop',
      },
      {
        caption: 'Variant D',
        imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=300&fit=crop',
      },
    ],
  },
  'visual-guide': {
    eyebrow: 'Workflow',
    title: 'Visual Guide',
    shortLabel: 'Guide',
    description: 'Step-by-step visual guidance for complex editing workflows.',
    bullets: [
      'Guided workflows',
      'Step tracking',
      'Quality evaluation',
      'Best practice templates',
    ],
    previews: [
      {
        caption: 'Step 1',
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop',
      },
      {
        caption: 'Step 2',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop',
      },
    ],
  },
  infographic: {
    eyebrow: 'Design',
    title: 'Infographic Generator',
    shortLabel: 'Info',
    description: 'Create professional infographics from data and text inputs.',
    bullets: [
      'Template library',
      'Data visualization',
      'Custom branding',
      'Export to multiple formats',
    ],
    previews: [
      {
        caption: 'Timeline',
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
      },
      {
        caption: 'Metrics',
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
      },
    ],
  },
};
