# Mulen Build Spec

## First Task Order

Start in this order:

1. Read all `docs/MULEN_*.md` files.
2. Audit the repository.
3. Locate existing React components, routes, API routes, AI provider abstractions, Supabase integration, storage, image history, generation, style transfer, upscale, reframe, relight, and provider settings.
4. Run `npm install`.
5. Run `npm run typecheck`.
6. Run `npm run build`.
7. If typecheck or build fails, fix those errors without changing product logic.
8. Create `docs/ARCHITECTURE_AUDIT.md`.
9. Create or update `docs/DATA_MODEL.md`.
10. Create or update `docs/MODULE_PIPELINES.md`.
11. Add TypeScript types for the shared project memory core.
12. Add the first Project Workspace UI.
13. Add version tree and timeline.
14. Add Photo Director MVP.
15. Add Variant Lab MVP.

Do not implement all six modules at once.

## Shared Architecture

All modules must use the same shared core:

- Project Memory,
- Version Tree,
- Locked Areas,
- Visual Canon,
- Model Router,
- Generation Jobs,
- Model Runs,
- Quality Evaluation,
- Export handling.

## Required TypeScript Types

Create or adapt types for:

- `MulenModule`,
- `Project`,
- `Asset`,
- `ImageVersion`,
- `EditStep`,
- `LockedArea`,
- `VisualCanon`,
- `RecurringObject`,
- `GenerationJob`,
- `ModelRun`,
- `QualityEvaluation`,
- `ModelTask`,
- `ModelRouterInput`,
- `ModelRouterOutput`,
- `InfographicLayout`,
- `InfographicSection`,
- `InfographicItem`.

## Recommended File Direction

Introduce this structure gradually when it fits the existing app:

```txt
src/
  app/
    App.tsx
    routes/
    layout/
  components/
    project/
      ProjectWorkspace.tsx
      VersionTree.tsx
      Timeline.tsx
      LockedAreasPanel.tsx
      VisualCanonPanel.tsx
      OutputGallery.tsx
      CompareView.tsx
    modules/
      photo-director/
      variant-lab/
      multi-angle-reframe/
      headswap/
      visual-guide/
      infographic-generator/
    shared/
      UploadPanel.tsx
      PromptBox.tsx
      BatchProgress.tsx
      ExportPanel.tsx
      ModelRunCard.tsx
      QualityBadges.tsx
  lib/
    api/
    supabase/
    storage/
    image/
    prompting/
    models/
    qa/
    jobs/
    exports/
  types/
    project.ts
    generation.ts
    providers.ts
    modules.ts
backend-links/
  services/
    aiProvider.ts
    modelRouter.ts
    serverProviderProxy.ts
    replicateService.ts
    falService.ts
  agents/
    projectAnalyzer.ts
    promptComposer.ts
    visualCanonAgent.ts
    preservationAgent.ts
    variationAgents.ts
    cameraPlanAgent.ts
    visualGuideAgent.ts
    infographicAgent.ts
    qualityJudge.ts
  utils/
    generationLineage.ts
    generationRecipe.ts
    imageComparison.ts
    maskUtils.ts
    exportUtils.ts
api/
  projects/
  assets/
  jobs/
  generate/
  modules/
    photo-director/
    variant-lab/
    multi-angle-reframe/
    headswap/
    visual-guide/
    infographic-generator/
```

Do not move everything at once if that would risk breaking the existing app.

## Minimum Definition of Done

The first usable version is done when:

- the user can create a project,
- the user can upload a photo,
- the user can create a first edit,
- the system saves a version,
- the user can continue from an existing version,
- the user can lock at least text-described areas,
- Variant Lab can create at least 8 labeled variants,
- generated outputs are saved to the project gallery,
- typecheck passes,
- build passes,
- the UI feels like a product workspace, not a technical tool panel.
