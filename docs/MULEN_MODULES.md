# Mulen Modules

## 1. Photo Director

The main editor for iterative changes to one photo.

Workflow:

1. User uploads a photo.
2. System creates a project.
3. System analyzes the image.
4. User states what to improve.
5. User states what must not change.
6. Prompt Composer creates a concrete edit prompt.
7. Model Router selects the internal route.
8. System generates 1-4 variants.
9. Quality Judge labels the outputs.
10. Outputs are saved as new versions.
11. User can continue from any version.

Important mode:

> Jen doladit

This mode should preserve most of the image and change only the requested detail. Internally the prompt must protect locked objects, faces, products, logos, and composition.

## 2. Variant Lab

Variant Lab creates controlled visual variants of one photo.

It is not random image variation. It must preserve the important object, identity, product, logo, and composition while exploring visual directions.

Inputs:

- source image,
- variant count: 4, 8, 12, or 20,
- intensity: subtle, medium, bold,
- target: web, advertising, social, product, portrait, interior, style,
- locked items: face, product, logo, hands, text, composition.

Output groups:

- nejvernejsi,
- nejlepsi pro reklamu,
- nejlepsi pro web,
- nejlepsi pro socialni site,
- nejodvaznejsi.

## 3. Multi-Angle Reframe

Multi-Angle Reframe creates a consistent camera set from one source image.

This is not simple cropping. It is a camera set generator.

Example shots:

- front shot,
- 45 degree left,
- 45 degree right,
- top-down,
- close-up detail,
- material detail,
- lifestyle context,
- hero ad shot,
- social vertical,
- banner with negative space.

If a generated angle shows something not visible in the source, the UI must tell the user that some angles are AI interpretation, not exact documentation of reality.

## 4. HeadSwap Studio

HeadSwap Studio compares multiple headswap/faceswap results and allows each result to be refined separately.

Required safety UX:

- use only with permission of the person,
- do not support identity abuse,
- do not support political/deepfake misuse,
- do not build impersonation workflows for public figures,
- output may be marked as AI-edited.

Pipeline should run at least four internal model strategies when available:

- identity-preserving,
- best blending,
- lighting and skin realism,
- creative fallback or alternate.

## 5. Visual Guide

Visual Guide turns one short sentence into a consistent visual step-by-step guide.

Claim:

> Jedna veta dovnitr. Cely obrazkovy navod ven.

Pipeline:

1. User enters one sentence.
2. Step Planner creates the guide structure.
3. System detects audience and difficulty.
4. Visual Canon defines series consistency.
5. Recurring objects are listed and locked.
6. Anchor frame is generated or defined.
7. Step prompts are composed.
8. Steps are generated sequentially or semi-batch.
9. Consistency QA runs.
10. Captions and exports are prepared.

## 6. Infographic Generator

Infographic Generator creates professional infographics from a topic, text, or data.

Critical rule:

Do not render the final infographic as a pure AI image with embedded text. Text must be real text rendered through HTML, CSS, SVG, and/or PDF.

Infographic types:

- educational,
- comparison,
- process,
- marketing,
- data,
- business plan,
- landing page section,
- checklist,
- timeline,
- funnel.

For factual topics, the app should ask for sources or let the user paste source text. Without sources, mark the output as a concept, not a verified factual document.
