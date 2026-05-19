# Architecture Audit

## Scope

This audit inspected the new app root at `/Volumes/CODEX_DISK/apps/Mulen master app` and the reference application at `/Volumes/CODEX_DISK/apps/Mulen-nano`.

The new app root initially contained only the `docs/MULEN_*.md` context files. The reference app was inspected read-only. No files were modified in `Mulen-nano`.

## Current New App State

`Mulen master app` now contains a working monorepo base with:

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/shared`
- project docs in `docs/`

The current web app is a project-memory MVP shell with Nano-inspired styling. It is intentionally not a redesign yet.

## Current Migration Strategy

The agreed implementation order is module-by-module migration.

Current rule:

1. Keep the shared Mulen core in the new app.
2. Use Mulen Nano as the temporary design baseline.
3. Port the first main workspace area in a shape that is close to Nano, but inside the new architecture.
4. Then port `reframe`.
5. Then port `faceswap`.
6. Then continue one module after another.

This reduces risk, keeps visual continuity, and avoids a broad rewrite before the architecture is proven.

## Mulen Nano Summary

`Mulen-nano` is a React + Vite application.

Key stack:

- React 19
- Vite 6
- TypeScript
- Tailwind CSS v4 Vite plugin
- lucide-react icons
- Supabase JS
- Gemini / OpenAI / Grok / Replicate / fal provider paths
- Express local dev server for API proxying

Important package scripts:

- `npm run dev`: runs `node server.mjs`
- `npm run dev:vite`: runs Vite directly
- `npm run typecheck`: `tsc -p tsconfig.json --noEmit`
- `npm run build`: `vite build`

Read-only verification:

- `npm run typecheck` passed in `Mulen-nano`.
- `npm run build` was intentionally not run inside `Mulen-nano` because it would write to `dist/`, and the reference app must not be modified.

## High-Level Nano Architecture

Nano is mostly a monolithic app centered on `App.tsx`.

Important entry points:

- `index.html`
- `index.tsx`
- `App.tsx`
- `src/index.css`

Important UI directories:

- `components/`
- `components/atelier/`
- `components/styleTransfer/`
- `components/modelInfluence/`

Important app screens already present:

- `components/ReframeScreen.tsx`
- `components/FaceSwapScreen.tsx`
- `components/AiUpscalerScreen.tsx`
- `components/StyleTransferScreen.tsx`
- `components/FluxLoraGeneratorScreen.tsx`
- `components/ImageGalleryPanel.tsx`

Routing is implemented inside `App.tsx` using `window.history` and route state, not a dedicated router package.

Detected routes include:

- `/`
- `/style-transfer`
- `/face-swap`
- `/flux-lora`
- `/model-influence`
- `/ai-upscaler`
- `/reframe`

## Existing Provider Architecture

Useful files:

- `services/aiProvider.ts`
- `services/providerFactory.ts`
- `services/geminiService.ts`
- `services/chatgptService.ts`
- `services/grokService.ts`
- `services/replicateService.ts`
- `services/fluxProService.ts`
- `services/falService.ts`
- `services/headSwapService.ts`
- `services/serverProviderProxy.ts`

`services/aiProvider.ts` defines a provider interface with:

- `generateImage`
- `enhancePrompt`
- `getName`
- `getType`

Supported provider IDs:

- `gemini`
- `grok`
- `chatgpt`
- `replicate`
- `flux_pro`

Nano exposes provider selection directly in UI. Mulen Photo Director should reuse the internal provider capability, but hide model/provider selection from normal users behind a new `modelRouter`.

## Existing Server/API Architecture

Nano has both Vercel-style API handlers and Netlify functions.

Useful API files:

- `api/provider-generate.js`
- `api/provider-key-test.js`
- `api/public-config.js`
- `api/r2-presign.js`
- `api/fal/lora-img2img.js`
- `api/replicate/predictions/index.ts`
- `api/_core/provider-generate.cjs`
- `api/_core/provider-key-test.cjs`
- `api/_core/r2-presign.cjs`
- `netlify/functions/provider-generate.js`
- `netlify/functions/provider-generate-core.cjs`

The local dev server in `server.mjs` loads these handlers and exposes:

- `GET /api/public-config`
- `GET /api/library-list`
- `POST /api/r2-presign`
- `POST /api/fal/lora-img2img`
- `POST /api/provider-generate`
- `POST /api/provider-key-test`
- `POST /api/replicate/predictions`
- `GET /api/replicate/predictions/:id`

Reusable idea:

- Keep a server proxy layer so browser clients do not have to call providers directly.
- Preserve server-side environment key fallback.
- Expand the proxy around `GenerationJob` and `ModelRun` instead of direct one-shot generation only.

## Existing Supabase Integration

Useful files:

- `utils/supabaseClient.ts`
- `utils/supabaseStorage.ts`
- `utils/galleryDB.ts`
- `utils/imageDatabase.ts`
- `utils/singleUserMediaStore.ts`
- `supabase-schema.sql`
- `supabase/migrations/*`

Existing tables:

- `users`
- `saved_images`
- `generated_images`
- `user_settings`
- `saved_prompts`

Existing storage:

- public `images` bucket
- user-folder paths
- saved and generated image folders

Existing generated image metadata includes:

- prompt
- storage path
- thumbnail path
- resolution
- aspect ratio
- params JSON

This is useful, but not enough for Mulen. Mulen needs project-level tables:

- projects
- assets
- image_versions
- edit_steps
- locked_areas
- visual_canons
- generation_jobs
- model_runs
- quality_evaluations

## Existing Gallery / Storage / History

Useful files:

- `utils/galleryDB.ts`
- `utils/imageDatabase.ts`
- `utils/generationLineage.ts`
- `utils/generationRecipe.ts`
- `types.ts`

Nano already has:

- local-first gallery storage,
- cloud mirror to Supabase,
- generated image thumbnails,
- source/style/asset image categorization,
- generated image params,
- image lineage metadata,
- version entries inside a generated image object.

Nano versioning is local to a generated image item:

- `versions?: ImageVersionEntry[]`
- `currentVersionIndex?: number`

Mulen needs to promote this idea into a first-class project-level non-linear version tree.

## Existing Generation

Main generation flow lives in `App.tsx`, especially the `processGenerationSnapshot` path.

Useful existing concepts:

- generation queue snapshot,
- provider settings snapshot,
- prompt composition,
- provider aspect-ratio mapping,
- retry/backoff for provider overload,
- parallel generation,
- progress display,
- automatic gallery save,
- generation recipe and lineage capture.

Files to reuse conceptually:

- `hooks/useGenerationQueue.ts`
- `hooks/useGenerationSnapshot.ts`
- `utils/promptComposition.ts`
- `utils/generationLineage.ts`
- `utils/generationRecipe.ts`
- `utils/generationFeedback.ts`

Risk:

- The generation logic is tightly coupled to `App.tsx` state and provider-visible UI.
- It should be extracted into module services in the new app, not copied wholesale into a new monolith.

## Existing Style Transfer

Useful files:

- `components/StyleTransferScreen.tsx`
- `components/styleTransfer/*`
- `services/arbitraryStyleTransferTfjs.ts`
- `services/neuralStyleTransferAlgorithms.ts`
- `services/replicateService.ts`
- `utils/styleStrength.ts`

Nano supports local TFJS style transfer and provider-backed style transfer. This can inform a later Mulen style/visual canon module, but it is not Phase 1.

## Existing Upscale

Useful files:

- `components/AiUpscalerScreen.tsx`
- `utils/upscaling.ts`

Nano has a UI and prompt pattern for faithful upscale/restore/enhance. Mulen should move this behind exports/detailing and `ModelTask = 'upscale'`.

## Existing Reframe

Useful file:

- `components/ReframeScreen.tsx`

Nano already defines many perspective prompts:

- extreme long shot,
- long shot,
- closeup,
- medium long,
- extreme closeup,
- low angle,
- back view,
- medium closeup,
- high angle,
- over-the-shoulder,
- wide,
- aerial,
- profile,
- POV,
- eye-level,
- three-quarter.

This is highly reusable for `Multi-Angle Reframe`, but Mulen must rename and reshape the workflow around camera plans, visual canon, shot purpose, and the warning that some angles are AI interpretation.

## Existing HeadSwap / FaceSwap

Useful files:

- `components/FaceSwapScreen.tsx`
- `services/headSwapService.ts`
- `utils/headSwapPrompt.ts`

Nano already supports:

- source image,
- target image,
- face/head mode,
- Gemini and OpenAI model choices,
- multiple outputs,
- progress,
- gallery save.

Mulen must add:

- stronger safety UX,
- minimum four strategy lanes or fallback lanes,
- separate per-output refinement prompts,
- labels like best identity, best blending, best light, lowest artifacts,
- final detail/upscale flow.

## Existing Provider Settings

Useful files:

- `hooks/useProviderSettings.ts`
- `components/SettingsModal.tsx`
- `components/ProviderSelector.tsx`
- `services/publicConfig.ts`

Nano stores provider settings locally and checks server availability. Mulen can preserve internal settings/admin behavior, but the main workspace should not expose provider names to normal users.

## What To Preserve

Preserve as reference or migrate gradually:

- provider interface and factory idea,
- server provider proxy,
- public config endpoint,
- provider key test endpoint,
- Supabase client/session handling,
- storage upload helpers,
- local-first gallery with cloud mirror,
- thumbnail generation,
- prompt composition patterns,
- generation recipe/lineage metadata,
- queue snapshot concept,
- reframe perspective prompt library,
- headswap prompt/service concepts,
- upscaler faithful prompt,
- atelier layout primitives if they fit the new design.

## What To Refactor

Refactor before using in Mulen core:

- `App.tsx` monolith into project/module components and services.
- Direct provider selection into internal `modelRouter`.
- Linear/generated-item version history into project-level version tree.
- Generic gallery into project-scoped output gallery.
- Generated image params into formal `ModelRun` and `GenerationJob`.
- Prompt-only generation into project memory pipelines.
- Technical controls into user-friendly module controls.

## Risky Areas

Highest risk:

- Copying `App.tsx` wholesale would recreate the monolith and fight the Mulen architecture.
- Running build or install inside `Mulen-nano` may change reference files or generated output.
- Existing Supabase tables are not sufficient for project memory.
- Existing UI exposes model/provider controls that conflict with Mulen UX.
- Batch generation is currently client-driven and should become job-driven for long-running module work.
- Provider APIs and model names are time-sensitive and should be isolated behind a router/proxy.

Medium risk:

- Supabase anonymous auth and RLS policies must be preserved carefully.
- Local-first storage is useful but needs project scoping.
- HeadSwap safety is not yet sufficient for the new product direction.

## Recommended Next Implementation Steps

1. Keep `Mulen-nano` untouched and use it only as read-only reference.
2. Move the current web shell into explicit `project` and `modules` component folders.
3. Port the primary Nano workspace/generation flow as the first real module area.
4. Connect that flow to the new shared project memory types and mock services.
5. After that stabilizes, port `reframe`.
6. Then port `faceswap`.
7. Then continue module-by-module instead of broad cross-app edits.
8. Run `npm run typecheck` and `npm run build` after each larger migration slice.

## Audit Verification

Commands run:

```bash
npm run typecheck
```

Result in `Mulen-nano`:

```txt
tsc -p tsconfig.json --noEmit
```

The command completed successfully.

`npm run build` was not run in `Mulen-nano` because it writes build output to `dist/`.
