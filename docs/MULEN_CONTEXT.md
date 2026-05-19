# Mulen Context

## Product Direction

Mulen is an AI Photo Director, not a generic AI image generator.

The product is built around managed visual projects: project memory, version history, locked areas, controlled variants, consistent series, exportable outputs, and quality evaluation.

Main product claim:

> Kdyz chces zmenit jednu vec, Mulen ti nerozbije vsechno ostatni.

Mulen should help users direct a visual project step by step instead of restarting from a new prompt every time.

## Core Value

Mulen must preserve what matters while changing only what the user asks to change.

The application should support:

- persistent projects,
- original source assets,
- all generated versions,
- non-linear version trees,
- locked objects and areas,
- visual canon per project,
- prompt and edit history,
- batch generation jobs,
- internal model routing,
- quality and consistency evaluation,
- export-ready outputs.

## Product Language

Primary headline:

> Mulen Photo Director

Subtitle:

> AI studio pro fotky, ktere si pamatuje projekt a drzi konzistenci.

Short positioning:

> Mulen je AI Photo Director pro lidi, kteri nechteji generovat od nuly, ale chteji ridit cely vizualni projekt krok za krokem.

## User Experience Principles

The UI must feel like a production workspace, not a technical playground.

Users should not see ordinary internal model controls such as:

- seed,
- sampler,
- CFG,
- denoise,
- provider name,
- model name,
- LoRA weight.

Those details may be stored internally for debugging, but the normal UI should expose human-level controls:

- what to improve,
- what must stay unchanged,
- variant count,
- intensity,
- target use,
- continue from this version,
- create similar variants,
- export.

## Non-Negotiables

- Do not start with a large UI rewrite.
- First audit the existing repository.
- Fix typecheck/build before product changes.
- Keep changes incremental and testable.
- If AI providers or API keys are missing, provide a safe mock/fallback mode.
- Do not edit the existing Mulen Nano source folder if it is present. Use it only as reference.
- Use the Codex in-app browser for local UI checks, not an external Chromium window.
