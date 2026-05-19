import type { NanoRoute } from '../../types/nano';

export type RailPreview = {
  imageUrl: string;
  caption: string;
};

export type RailInfo = {
  eyebrow: string;
  title: string;
  shortLabel: string;
  description: string;
  bullets: string[];
  previews: RailPreview[];
};

const commonMainPreviewSet: RailPreview[] = [
  {
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80',
    caption: 'before / after',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=600&q=80',
    caption: 'product polish',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
    caption: 'clean scene',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    caption: 'premium output',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    caption: 'detail pass',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=600&q=80',
    caption: 'quality',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=600&q=80',
    caption: 'sharp edge',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
    caption: 'social crop',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80',
    caption: 'final frame',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=600&q=80',
    caption: 'export set',
  },
];

export const RAIL_INFO: Record<NanoRoute, RailInfo> = {
  mulen: {
    eyebrow: 'MODULE',
    title: 'Photo Director',
    shortLabel: 'MAIN',
    description:
      'Hlavni rezim pro ladeni jedne fotky. Slouzi k uprave svetla, pozadi, kompozice a finalniho vzhledu.',
    bullets: [
      'vylepseni jedne hlavni fotky',
      'zachovani produktu a identity',
      'finalni polish pro premium vystup',
    ],
    previews: commonMainPreviewSet,
  },
  'ai-upscaler': {
    eyebrow: 'MODULE',
    title: 'AI Upscaler',
    shortLabel: 'SCALE',
    description:
      'Rezim pro zvetseni a doostreni obrazku. Hodi se pro vyssi kvalitu, export a kontrolu detailu.',
    bullets: ['upscale do 2K nebo 4K', 'ostrejsi hrany a detaily', 'focus na cely obraz, tvar nebo produkt'],
    previews: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80',
        caption: 'detail',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=600&q=80',
        caption: 'sharpness',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
        caption: '2K / 4K',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=600&q=80',
        caption: 'export quality',
      },
      ...commonMainPreviewSet.slice(0, 6),
    ],
  },
  'face-swap': {
    eyebrow: 'MODULE',
    title: 'Face Swap',
    shortLabel: 'FACE',
    description:
      'Rezim pro vymenu obliceje nebo identity v obrazku. Pracuje se source face a target scenou.',
    bullets: ['nahrani zdrojove tvare', 'pouziti na cilovy obrazek', 'vice variant pro vyber'],
    previews: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
        caption: 'source',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
        caption: 'target',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=600&q=80',
        caption: 'variant',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
        caption: 'selection',
      },
      ...commonMainPreviewSet.slice(0, 6),
    ],
  },
  reframe: {
    eyebrow: 'MODULE',
    title: 'Reframe',
    shortLabel: 'FRAME',
    description:
      'Rezim pro vytvoreni vice zaberu z jednoho obrazku. Pomaha udelat ruzne uhly, vyrezy a formaty.',
    bullets: ['vice kompozic z jednoho zdroje', 'social, web nebo produktove vyrezy', 'zachovani hlavniho motivu'],
    previews: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
        caption: 'wide',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=600&q=80',
        caption: 'product',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
        caption: 'square',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
        caption: 'social crop',
      },
      ...commonMainPreviewSet.slice(0, 6),
    ],
  },
  'variant-lab': {
    eyebrow: 'MODULE',
    title: 'Variant Lab',
    shortLabel: 'VAR',
    description:
      'Laborator pro rychle generovani variant obrazku. Slouzi k hledani novych vizualnich smeru.',
    bullets: ['vice verzi najednou', 'ruzne styly a intenzity', 'porovnani proti originalu'],
    previews: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=600&q=80',
        caption: 'base',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80',
        caption: 'variant 01',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
        caption: 'variant 02',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
        caption: 'variant 03',
      },
      ...commonMainPreviewSet.slice(0, 6),
    ],
  },
  'visual-guide': {
    eyebrow: 'MODULE',
    title: 'Visual Guide',
    shortLabel: 'GUIDE',
    description:
      'Rezim pro tvorbu vizualniho navodu krok za krokem. Z promptu vytvori konzistentni serii obrazku.',
    bullets: ['navod v nekolika krocich', 'jednotny vizualni styl', 'vhodne pro carousel, PDF, blog nebo web'],
    previews: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
        caption: 'step 01',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
        caption: 'step 02',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80',
        caption: 'step 03',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80',
        caption: 'final',
      },
      ...commonMainPreviewSet.slice(0, 6),
    ],
  },
  infographic: {
    eyebrow: 'MODULE',
    title: 'Infographic Generator',
    shortLabel: 'INFO',
    description:
      'Rezim pro tvorbu infografik. Vystup ma byt skutecny layout s textem, ne jen obrazek z image modelu.',
    bullets: ['edukativni nebo business infografika', 'realny text a sekce', 'formaty A4, square, story nebo wide'],
    previews: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
        caption: 'data',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
        caption: 'layout',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
        caption: 'business',
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=600&q=80',
        caption: 'export',
      },
      ...commonMainPreviewSet.slice(0, 6),
    ],
  },
};
