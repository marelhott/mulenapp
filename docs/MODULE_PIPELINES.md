# Module Pipelines

## Shared Pipeline Primitives

Every module should use the same primitives:

1. Project
2. Assets
3. Active version
4. Locked areas
5. Visual canon
6. Prompt planning
7. Model routing
8. Generation job
9. Model runs
10. Quality evaluation
11. Version tree update
12. Export

## Photo Director MVP

Purpose:

Iteratively edit one photo without restarting the project.

Pipeline:

```txt
Upload image
  -> create Project
  -> create original Asset
  -> create original ImageVersion
  -> analyze image
  -> create or update VisualCanon
  -> user instruction
  -> locked area selection
  -> Prompt Composer
  -> Model Router task: precise_edit
  -> GenerationJob
  -> 1-4 ModelRuns
  -> QualityEvaluation
  -> save output Assets
  -> save child ImageVersions
  -> update activeVersionId
```

Important mode:

`Jen doladit` means:

- preserve current image structure,
- keep locked objects unchanged,
- make only the requested change,
- avoid changing face/product/logo/composition.

## Variant Lab MVP

Purpose:

Create controlled visual directions of one photo while preserving what matters.

Pipeline:

```txt
Select source version
  -> read project VisualCanon
  -> create PreservationSpec
  -> generate variation directions
  -> compose prompts for each direction
  -> Model Router task: creative_variation
  -> GenerationJob with 4/8/12/20 ModelRuns
  -> save outputs as child branches
  -> QualityEvaluation
  -> group gallery labels
```

Variation agents can be simple planning functions:

- Preservation Agent
- Light & Mood Agent
- Composition Agent
- Background / Context Agent
- Brand Style Agent
- Creative Risk Agent
- Quality Judge

Initial gallery groups:

- Nejvernejsi
- Nejlepsi pro reklamu
- Nejlepsi pro web
- Nejlepsi pro socialni site
- Nejodvaznejsi

## Multi-Angle Reframe MVP

Purpose:

Generate a consistent camera set, not just crop/reframe one image.

Pipeline:

```txt
Select source version
  -> create Camera Plan
  -> enforce VisualCanon
  -> Model Router task: multi_angle
  -> GenerationJob with 8-15 shot ModelRuns
  -> save each shot as version branch
  -> QualityEvaluation
  -> grouped Camera Set gallery
```

Shot groups:

- Hero
- Detail
- Context
- Social
- Banner
- Close-up
- Lifestyle
- Wide

Trust warning:

If generated angles include unseen sides or spaces, the UI must say that some angles are AI interpretation, not exact documentation of reality.

## HeadSwap Studio MVP

Purpose:

Compare multiple headswap/faceswap strategies and refine each output independently.

Pipeline:

```txt
Upload source face/head
  -> upload target image
  -> safety acknowledgement
  -> compose four strategy prompts
  -> Model Router task: headswap
  -> GenerationJob with at least 4 strategy ModelRuns or fallbacks
  -> save outputs
  -> QualityEvaluation
  -> compare gallery
  -> per-output refinement prompts
  -> optional detailer/upscale
```

Safety:

- require permission,
- do not support identity abuse,
- do not support political/deepfake misuse,
- do not target public-person impersonation workflows.

## Visual Guide MVP

Purpose:

Turn one sentence into a consistent illustrated step-by-step guide.

Pipeline:

```txt
One-sentence user prompt
  -> Step Planner
  -> audience/difficulty detection
  -> VisualCanon
  -> recurring object list
  -> anchor frame
  -> step prompts
  -> sequential/semi-batch generation
  -> consistency QA
  -> captions
  -> export
```

Recurring object type:

```ts
type GuideRecurringObject = {
  name: string;
  description: string;
  mustAppearInSteps?: number[];
  mustRemainConsistent: boolean;
};
```

## Infographic Generator MVP

Purpose:

Create professional infographics with real text, not rasterized AI text.

Pipeline:

```txt
Topic / source text / data
  -> Topic Analyzer
  -> Audience Detection
  -> Infographic Type Selector
  -> Content Outline
  -> Copy Compression
  -> Visual Hierarchy
  -> Layout Schema
  -> React/HTML/SVG render
  -> PDF/PNG/HTML export
```

Important rule:

The final infographic must be rendered as HTML/CSS/SVG/PDF with real text. AI image generation may be used for supporting illustrations only.

Factual topics:

- ask for a source,
- allow pasted source text,
- mark unsourced output as concept only.

## Model Router

Initial router behavior can be deterministic.

Example:

- `precise_edit` -> internal high-fidelity image edit route
- `creative_variation` -> image edit or variation route
- `identity_preserving` -> identity-preserving route
- `multi_angle` -> image edit route with camera plan prompts
- `headswap` -> headswap strategy route
- `upscale` -> faithful upscale route
- `infographic_illustration` -> illustration route only, not final text render

The router returns provider/model metadata internally. Normal UI should show only friendly language.

## Job System

Initial mock job:

1. Create job in local store.
2. Set status to `running`.
3. Create mock `ModelRun` entries.
4. Resolve each run into a generated asset/version.
5. Update progress.
6. Finish as `succeeded`, `partial`, or `failed`.

Later real job:

1. Client posts job to API.
2. API stores job in Supabase.
3. Worker processes model runs.
4. Client polls job state.
5. Outputs appear progressively.

## Quality Evaluation

Initial QA can be rule-based labels.

Later QA can use image analysis.

Fields:

- identity preservation,
- object preservation,
- style consistency,
- commercial usefulness,
- artifact risk,
- labels,
- summary.

## Export Handling

Export should be module-specific but use shared asset/project metadata.

Required export types:

- PNG/JPG
- before/after
- ZIP
- camera set
- carousel
- PDF
- HTML
- SVG when useful
