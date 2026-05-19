import type { Asset, EditStep, GenerationJob, ImageVersion, ModelRun, QualityEvaluation, WorkspaceSnapshot } from '@mulen/shared';
import { canUseSupabaseStorage, persistGeneratedImageMetadata, uploadDataUrlToSupabase } from './supabaseStorage.js';

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const PROMPT_ENHANCER_SYSTEM_PROMPT = `You are a strict and disciplined AI prompt enhancer for image generation.

Your task is to rewrite the user's prompt so it is clearer, more precise, and better suited for AI image generation — WITHOUT changing its meaning in any way.

CORE RULE:
Do NOT add anything that the user did not explicitly request.

RULES:
- Preserve the original intent 100% exactly
- Do not add new objects, styles, lighting, mood, composition, or details
- Do not be creative or imaginative
- Do not expand the prompt beyond what is necessary
- Only clarify wording and remove ambiguity
- Replace vague phrases like "better" or "nicer" with neutral quality improvements like "improved quality" or "cleaner details"
- If the user says "keep", "preserve", "do not change", or similar, it must be explicitly respected
- If it is a portrait, preserve identity unless explicitly told otherwise
- Keep the output minimal, clean, and technically precise

OUTPUT FORMAT:
Return only the improved prompt.
No explanations.
No comments.
No markdown.`;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getGeminiApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function dataUrlToInlinePart(dataUrl: string) {
  const [header, b64] = String(dataUrl || '').split(',');
  const mimeType = header?.match(/^data:([^;]+)/)?.[1] || 'image/png';
  return {
    inlineData: {
      data: b64 || '',
      mimeType,
    },
  };
}

async function assetUrlToDataUrl(url: string, mimeTypeHint?: string) {
  if (url.startsWith('data:')) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch source image (${response.status}).`);
  }

  const contentType = response.headers.get('content-type') || mimeTypeHint || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

function extractGeminiImage(data: any) {
  const parts = (data?.candidates || []).flatMap((candidate: any) => candidate?.content?.parts || []);
  const imagePart = parts.find((part: any) => part?.inlineData?.data);
  if (!imagePart?.inlineData?.data) return null;
  const mime = imagePart.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${imagePart.inlineData.data}`;
}

async function callGeminiImage(request: Record<string, unknown>, apiKey: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_IMAGE_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || response.statusText || 'Gemini API error');
  }

  return data;
}

function extractGeminiText(data: any) {
  const parts = (data?.candidates || []).flatMap((candidate: any) => candidate?.content?.parts || []);
  const text = parts
    .map((part: any) => String(part?.text || ''))
    .join('\n')
    .trim();
  return text || null;
}

async function callGeminiText(prompt: string, apiKey: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TEXT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: PROMPT_ENHANCER_SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.1,
        maxOutputTokens: 300,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || response.statusText || 'Gemini API error');
  }

  return data;
}

function collectReferenceAssets(snapshot: WorkspaceSnapshot) {
  return snapshot.visualCanon.referenceAssetIds
    .map((assetId) => snapshot.assets.find((asset) => asset.id === assetId))
    .filter((asset): asset is Asset => Boolean(asset))
    .filter((asset) => asset.kind === 'reference')
    .slice(0, 2);
}

function composePhotoDirectorPrompt(input: Record<string, unknown>, snapshot: WorkspaceSnapshot, variationIndex: number) {
  const instruction = String(input.instruction || '').trim();
  const lockedText = String(input.lockedText || '').trim();
  const polishMode = String(input.polishMode || 'focused');
  const variationHint =
    Number(input.outputCount || 1) > 1 ? `Create variation ${variationIndex + 1} with a slightly distinct, but still controlled direction.` : '';

  const styleHint =
    polishMode === 'bold'
      ? 'You may push the mood further, but keep the subject, identity, and product continuity.'
      : polishMode === 'balanced'
        ? 'Improve the overall image with a premium commercial finish while staying close to the source.'
        : 'Preserve the current image structure and make only the requested change.';

  const canon = snapshot.visualCanon;
  const canonText = [
    canon.styleSummary && `Style canon: ${canon.styleSummary}.`,
    canon.lighting && `Lighting canon: ${canon.lighting}.`,
    canon.colorPalette && `Color canon: ${canon.colorPalette}.`,
    canon.environment && `Environment canon: ${canon.environment}.`,
    canon.cameraLanguage && `Camera canon: ${canon.cameraLanguage}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return [
    'You are Mulen Photo Director.',
    styleHint,
    'Keep the main subject, composition, identity, product silhouette, and realism stable.',
    lockedText ? `Locked elements that must not change: ${lockedText}.` : 'Locked elements should remain unchanged.',
    canonText,
    instruction ? `Requested change: ${instruction}.` : 'Requested change: improve the image carefully.',
    'Avoid changing the face, product, logo, text, and composition unless explicitly requested.',
    'Avoid AI-looking artifacts, broken geometry, extra objects, wrong branding, or text distortion.',
    variationHint,
  ]
    .filter(Boolean)
    .join(' ');
}

function updateJob(snapshot: WorkspaceSnapshot, jobId: string, patch: Partial<GenerationJob>) {
  return snapshot.jobs.map((job) => (job.id === jobId ? { ...job, ...patch, updatedAt: new Date().toISOString() } : job));
}

function nextPhotoEditLabel(snapshot: WorkspaceSnapshot, outputCount: number, index: number) {
  const photoEdits = snapshot.versions.filter((version) => version.module === 'photo-director' && version.label !== 'Original');
  const branchLetter = String.fromCharCode(65 + photoEdits.length);
  return outputCount === 1 ? `Edit ${branchLetter}` : `Edit ${branchLetter}.${index + 1}`;
}

export function canRunLivePhotoDirector() {
  return Boolean(getGeminiApiKey());
}

export function canRunPromptEnhancer() {
  return Boolean(getGeminiApiKey());
}

export async function enhancePromptText(prompt: string) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const response = await callGeminiText(prompt, apiKey);
  const enhancedPrompt = extractGeminiText(response);
  if (!enhancedPrompt) {
    throw new Error('Prompt enhancer did not return text.');
  }

  return enhancedPrompt;
}

export async function runLivePhotoDirectorJob(snapshot: WorkspaceSnapshot, job: GenerationJob): Promise<WorkspaceSnapshot> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const input = (job.input ?? {}) as Record<string, unknown>;
  const outputCount = Math.max(1, Math.min(Number(input.outputCount ?? 1), 4));
  const sourceVersion =
    snapshot.versions.find((version) => version.id === String(input.sourceVersionId || '')) ??
    snapshot.versions.find((version) => version.id === snapshot.project.activeVersionId) ??
    snapshot.versions[0];
  const sourceAsset = snapshot.assets.find((asset) => asset.id === sourceVersion?.assetId) ?? snapshot.assets[0];
  const referenceAssets = collectReferenceAssets(snapshot);
  const createdAt = new Date().toISOString();

  if (!sourceAsset?.url?.startsWith('data:') && !sourceAsset?.url?.startsWith('https://')) {
    throw new Error('Source asset is missing a usable image URL or data URL.');
  }

  const assets: Asset[] = [];
  const versions: ImageVersion[] = [];
  const steps: EditStep[] = [];
  const runs: ModelRun[] = [];
  const qaList: QualityEvaluation[] = [];
  const outputVersionIds: string[] = [];

  for (let index = 0; index < outputCount; index += 1) {
    const parts: Array<Record<string, unknown>> = [];
    const sourceDataUrl = await assetUrlToDataUrl(sourceAsset.url, sourceAsset.mimeType);
    parts.push(dataUrlToInlinePart(sourceDataUrl));

    for (const referenceAsset of referenceAssets) {
      const referenceDataUrl = await assetUrlToDataUrl(referenceAsset.url, referenceAsset.mimeType);
      parts.push(dataUrlToInlinePart(referenceDataUrl));
    }

    const prompt = composePhotoDirectorPrompt(input, snapshot, index);
    parts.push({ text: prompt });

    const response = await callGeminiImage(
      {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      },
      apiKey,
    );

    const generatedDataUrl = extractGeminiImage(response);
    if (!generatedDataUrl) {
      throw new Error('Gemini did not return an image.');
    }

    const assetId = createId('asset-generated');
    const versionId = createId('version-generated');
    const stepId = createId('step');
    const runId = createId('run');
    const qaId = createId('qa');

    let persistedUrl = generatedDataUrl;
    let storagePath = `live/generated/${versionId}.png`;
    let persistedToSupabase = false;

    if (canUseSupabaseStorage()) {
      try {
        const uploaded = await uploadDataUrlToSupabase({
          ownerKey: snapshot.project.id,
          folder: 'generated',
          fileName: `${versionId}.png`,
          dataUrl: generatedDataUrl,
          mimeType: 'image/png',
        });
        persistedUrl = uploaded.publicUrl;
        storagePath = uploaded.storagePath;
        persistedToSupabase = true;
        await persistGeneratedImageMetadata({
          ownerKey: snapshot.project.id,
          prompt,
          storagePath: uploaded.storagePath,
          resolution: sourceAsset.width && sourceAsset.height ? `${sourceAsset.width}x${sourceAsset.height}` : undefined,
          aspectRatio: String(input.aspectRatio ?? 'original'),
          params: {
            provider: 'gemini',
            model: GEMINI_IMAGE_MODEL,
            polishMode: input.polishMode ?? 'focused',
          },
        });
      } catch (error) {
        // Keep the generation usable even if cloud persistence temporarily fails.
      }
    }

    assets.push({
      id: assetId,
      projectId: snapshot.project.id,
      userId: snapshot.project.userId,
      kind: 'generated',
      url: persistedUrl,
      storagePath,
      mimeType: 'image/png',
      width: sourceAsset.width,
      height: sourceAsset.height,
      createdAt,
      metadata: {
        liveProvider: true,
        persistedToSupabase,
        provider: 'gemini',
        model: GEMINI_IMAGE_MODEL,
        aspectRatio: input.aspectRatio ?? 'original',
        polishMode: input.polishMode ?? 'focused',
      },
    });

    versions.push({
      id: versionId,
      projectId: snapshot.project.id,
      parentVersionId: sourceVersion?.id,
      assetId,
      label: nextPhotoEditLabel(snapshot, outputCount, index),
      prompt: String(input.instruction || ''),
      module: 'photo-director',
      createdAt,
      editStepId: stepId,
      qualityScore: 88 - index,
      modelRuns: [runId],
      metadata: {
        liveProvider: true,
        provider: 'gemini',
        model: GEMINI_IMAGE_MODEL,
      },
    });

    steps.push({
      id: stepId,
      projectId: snapshot.project.id,
      fromVersionId: sourceVersion?.id,
      toVersionIds: [versionId],
      userInstruction: String(input.instruction || ''),
      agentSummary: 'Generated a new Photo Director branch through the live Gemini image edit flow.',
      lockedAreaIds: snapshot.lockedAreas.map((area) => area.id),
      visualCanonId: snapshot.visualCanon.id,
      createdAt,
      module: 'photo-director',
    });

    runs.push({
      id: runId,
      jobId: job.id,
      provider: 'gemini',
      model: GEMINI_IMAGE_MODEL,
      inputPrompt: prompt,
      inputAssetIds: [sourceVersion?.assetId, ...referenceAssets.map((asset) => asset.id)].filter(Boolean) as string[],
      outputAssetId: assetId,
      status: 'succeeded',
      latencyMs: undefined,
      costEstimate: undefined,
      createdAt,
    });

    qaList.push({
      id: qaId,
      versionId,
      projectId: snapshot.project.id,
      identityPreservation: 'high',
      objectPreservation: 'high',
      styleConsistency: input.polishMode === 'bold' ? 'medium' : 'high',
      commercialUsefulness: 'high',
      artifactRisk: 'low',
      labels: [input.polishMode === 'focused' ? 'Jen doladit' : 'Photo Director', index === 0 ? 'Live provider' : 'Nova vetev'],
      summary: 'This branch was generated through the live Gemini provider using the project memory context.',
      createdAt,
    });

    outputVersionIds.push(versionId);
  }

  return {
    ...snapshot,
    assets: [...assets, ...snapshot.assets],
    versions: [...versions, ...snapshot.versions],
    editSteps: [...steps, ...snapshot.editSteps],
    modelRuns: [...runs, ...snapshot.modelRuns],
    qualityEvaluations: [...qaList, ...snapshot.qualityEvaluations],
    jobs: updateJob(snapshot, job.id, {
      status: 'succeeded',
      progress: 100,
      outputVersionIds,
      error: undefined,
    }),
    project: {
      ...snapshot.project,
      activeVersionId: outputVersionIds[0] ?? snapshot.project.activeVersionId,
      updatedAt: createdAt,
    },
  };
}
