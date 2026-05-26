export function buildSimpleLinkPrompt(
  mode: 'style' | 'merge' | 'object',
  extra: string,
  sourceImageCount: number,
  styleImageCount: number,
  assetImageCount: number,
) {
  const header = `
[LINK MODE: ${mode.toUpperCase()}]
Images order: first ${sourceImageCount} input image(s), then ${styleImageCount} style image(s), then ${assetImageCount} proprietary asset image(s).
`;

  if (mode === 'style') {
    return `${header}
Apply the visual style, composition, lighting, color grading, lens feel, and overall mood from the style image(s) to the input image(s), while preserving the identity and content of the input subject(s). Do NOT transfer objects/content from style; transfer only aesthetic and photographic/artistic treatment.

${extra ? `Additional instructions:\n${extra}\n` : ''}`.trim();
  }

  if (mode === 'merge') {
    return `${header}
Create a cohesive merge of input and style images. You may blend both aesthetic and content elements to produce a unified result that feels intentional, natural, and high quality. Use the style image(s) as a compositional template when helpful, but preserve the identity of subjects from the input image(s).

${extra ? `Additional instructions:\n${extra}\n` : ''}`.trim();
  }

  return `${header}
Transfer the dominant object/element from the style image(s) onto the input image(s) in a realistic way. Keep the input scene intact and place/replace the matching region with the style object, with correct perspective, lighting, scale, and shadows.

${extra ? `Additional instructions:\n${extra}\n` : ''}`.trim();
}
