export interface PromptCategories {
  subject: string;
  environment: string;
  style: string;
  lighting: string;
  mood: string;
  technical: string;
  other: string;
}

const SUBJECT_KEYWORDS = ['portrait', 'person', 'man', 'woman', 'cat', 'dog', 'animal', 'car', 'building', 'flower', 'tree', 'robot', 'face', 'character', 'pes', 'kocka'];
const ENVIRONMENT_KEYWORDS = ['background', 'scene', 'forest', 'city', 'ocean', 'mountain', 'desert', 'room', 'garden', 'space', 'street', 'park', 'beach', 'interior', 'landscape'];
const STYLE_KEYWORDS = ['style', 'painting', 'photograph', 'illustration', 'watercolor', 'digital art', 'anime', 'realistic', 'abstract', 'surreal', 'minimalist', 'render', '3d', 'sketch'];
const LIGHTING_KEYWORDS = ['light', 'lighting', 'shadow', 'dark', 'bright', 'golden hour', 'sunset', 'sunrise', 'dramatic', 'soft', 'studio lighting', 'neon'];
const MOOD_KEYWORDS = ['mood', 'atmosphere', 'feeling', 'mysterious', 'serene', 'vibrant', 'melancholy', 'epic', 'cozy', 'romantic', 'dreamy', 'nostalgic'];
const TECHNICAL_KEYWORDS = ['resolution', '4k', '8k', 'hd', 'detailed', 'sharp', 'bokeh', 'depth of field', 'macro', 'wide angle', 'photorealistic', 'cinematic', '35mm', '50mm', '85mm'];

export function parsePromptToCategories(prompt: string): PromptCategories {
  const result: PromptCategories = {
    subject: '',
    environment: '',
    style: '',
    lighting: '',
    mood: '',
    technical: '',
    other: '',
  };

  const parts = prompt.split(/[,;.\n]+/).map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (TECHNICAL_KEYWORDS.some((keyword) => lower.includes(keyword))) result.technical += `${result.technical ? ', ' : ''}${part}`;
    else if (LIGHTING_KEYWORDS.some((keyword) => lower.includes(keyword))) result.lighting += `${result.lighting ? ', ' : ''}${part}`;
    else if (MOOD_KEYWORDS.some((keyword) => lower.includes(keyword))) result.mood += `${result.mood ? ', ' : ''}${part}`;
    else if (STYLE_KEYWORDS.some((keyword) => lower.includes(keyword))) result.style += `${result.style ? ', ' : ''}${part}`;
    else if (ENVIRONMENT_KEYWORDS.some((keyword) => lower.includes(keyword))) result.environment += `${result.environment ? ', ' : ''}${part}`;
    else if (SUBJECT_KEYWORDS.some((keyword) => lower.includes(keyword))) result.subject += `${result.subject ? ', ' : ''}${part}`;
    else if (!result.subject) result.subject = part;
    else result.other += `${result.other ? ', ' : ''}${part}`;
  }

  return result;
}

export function semanticRemix(
  promptA: string,
  promptB: string,
  mix: Partial<Record<keyof PromptCategories, 'A' | 'B'>>,
): string {
  const catA = parsePromptToCategories(promptA);
  const catB = parsePromptToCategories(promptB);

  return [
    (mix.subject === 'B' ? catB.subject : catA.subject) || catA.subject,
    (mix.environment === 'B' ? catB.environment : catA.environment) || catA.environment,
    (mix.style === 'B' ? catB.style : catA.style) || catA.style,
    (mix.lighting === 'B' ? catB.lighting : catA.lighting) || catA.lighting,
    (mix.mood === 'B' ? catB.mood : catA.mood) || catA.mood,
    (mix.technical === 'B' ? catB.technical : catA.technical) || catA.technical,
    (mix.other === 'B' ? catB.other : catA.other) || catA.other,
  ]
    .filter((part) => part.trim().length > 0)
    .join(', ');
}
