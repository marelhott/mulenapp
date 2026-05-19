# Mulen Pipelines

## Project Memory

Each project stores:

- original image,
- all assets,
- all versions,
- all prompts,
- masks,
- locked areas,
- edit notes,
- generated variants,
- favorites,
- rejected variants,
- exports,
- model metadata,
- quality scores,
- step history.

## Version Tree

Version history must be non-linear.

```txt
Original
 ├─ Edit A
 │   ├─ A1
 │   └─ A2
 ├─ Edit B
 │   ├─ B1
 │   └─ B2
 └─ Edit C
```

The user must be able to:

- return to an older version,
- branch from any version,
- continue from any result,
- mark one version as best,
- export the final result.

## Locked Areas

Locked areas may represent:

- face,
- product,
- logo,
- hands,
- text,
- room,
- composition,
- custom object.

They may be stored as:

- text description,
- mask asset,
- bounding box,
- object metadata,
- strictness level.

## Visual Canon

Visual Canon defines the internal visual bible for a project:

- style,
- lighting,
- environment,
- color palette,
- camera language,
- materials,
- recurring objects,
- brand references,
- do-not-change rules,
- avoid rules.

Visual Canon is required for Variant Lab, Multi-Angle Reframe, Visual Guide, and Infographic Generator.

## Model Router

The user should not choose the technical model.

The router internally decides the provider/model route for:

- precise edit,
- creative variation,
- identity preservation,
- style transfer,
- multi-angle generation,
- headswap,
- visual guide step,
- upscale,
- infographic illustration.

The router output must be stored internally with provider, model, reason, and fallback providers.

## Batch Orchestration

Batch generation should use jobs and model runs instead of one long blocking request.

Flow:

1. Client creates a `GenerationJob`.
2. API stores the job.
3. Worker or polling endpoint processes `ModelRun` items.
4. Client reads progress.
5. Outputs are saved as they finish.
6. Job can finish as `succeeded`, `failed`, or `partial`.

Progress is calculated by completed model runs.

## Quality Evaluation

Each output should be evaluated for:

- identity preservation,
- object preservation,
- style consistency,
- commercial usefulness,
- artifact risk,
- series consistency,
- suitability for web, ads, or social.

Potential labels:

- nejvernejsi,
- nejreklamnejsi,
- nejcistsi,
- nejlepsi pro web,
- nejlepsi pro Instagram,
- nejodvaznejsi,
- riziko zmeny identity,
- riziko zmeny produktu.

## Export Pipelines

Photo Director:

- PNG/JPG,
- 2K/4K,
- before/after,
- web hero,
- social crop.

Variant Lab:

- individual variants,
- ZIP,
- gallery,
- best selection.

Multi-Angle Reframe:

- camera set,
- ZIP,
- social pack,
- product pack.

HeadSwap:

- final version,
- comparison of 4 models,
- before/after.

Visual Guide:

- carousel,
- PDF,
- numbered steps,
- web section.

Infographic Generator:

- PDF,
- PNG,
- HTML,
- SVG when appropriate.
