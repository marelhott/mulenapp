# Mulen MVP Roadmap

## Phase 0: Audit

Goals:

- inspect the repository,
- identify the existing app architecture,
- identify what can be reused,
- identify what is risky,
- run install, typecheck, and build,
- fix build/typecheck without changing product logic,
- write `docs/ARCHITECTURE_AUDIT.md`.

Do not start with a big UI rewrite.

## Phase 1: Project Memory Core

Implement:

- Project,
- Asset,
- ImageVersion,
- EditStep,
- LockedArea,
- VisualCanon,
- GenerationJob,
- ModelRun,
- QualityEvaluation.

UI:

- project dashboard or project shell,
- workspace,
- version tree,
- timeline,
- locked areas panel,
- visual canon panel,
- output gallery.

If backend or Supabase is not ready, use a safe mock store that keeps the UI and data flow working.

## Build Order Rule

After the shared core is in place, continue one application area at a time instead of attempting a broad rewrite.

Working order:

1. First port the primary Nano-like workspace shell and the base generation flow into the new project structure.
2. Then port `reframe`.
3. Then port `faceswap`.
4. Then continue with the next module one by one.

The first step should be close to a structured copy of the main Nano experience, but moved into the new Mulen architecture with:

- shared project memory,
- cleaner module boundaries,
- hidden provider/model complexity,
- no edits inside the original `Mulen-nano` folder.

## Phase 2: Photo Director MVP

Implement:

- upload,
- edit instruction,
- locked areas as text first,
- `Jen doladit` mode,
- generate variants,
- save versions,
- continue from any version.

The first real value is proving that one project can hold multiple edits and branches without losing continuity.

Implementation note:

This first module should be the closest to the current Nano app in interaction shape and visual rhythm. Use Nano as the temporary design baseline until the product-specific redesign happens later.

## Phase 3: Variant Lab MVP

Implement:

- variant count,
- intensity,
- target use,
- preservation spec,
- variation directions,
- multi-run orchestration,
- labeled output gallery,
- continue from selected variant.

Variant Lab must create controlled directions, not random variations.

## Phase 4: Multi-Angle Reframe MVP

Implement:

- camera plan,
- visual canon,
- 8-15 shots,
- grouped camera set gallery,
- clear notice when angles are AI interpretation.

## Phase 5: HeadSwap Studio MVP

Implement:

- source face/head upload,
- target image upload,
- 4 internal model strategies or fallbacks,
- comparison gallery,
- separate refinement prompt per result,
- final detailer/upscale options,
- safety UX.

## Phase 6: Visual Guide MVP

Implement:

- one-sentence input,
- step planner,
- visual canon,
- recurring object lock,
- anchor frame,
- 5-10 step prompts,
- captions,
- carousel/PDF export.

## Phase 7: Infographic Generator MVP

Implement:

- topic/text input,
- infographic type,
- outline,
- layout schema,
- HTML/SVG render,
- PDF/PNG export,
- factual-source warning when needed.

## Development Rule

After each larger change, run:

```bash
npm run typecheck
npm run build
```

If a command is missing because the project is not initialized yet, document that in the audit and create the minimal project structure before continuing.
