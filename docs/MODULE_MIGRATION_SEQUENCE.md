# Module Migration Sequence

## Principle

Mulen should be migrated one application area at a time.

The goal is to avoid:

- a giant rewrite,
- unstable cross-module refactors,
- losing the working Nano interaction model too early.

## Temporary Design Baseline

Use `Mulen-nano` as the temporary design baseline until later product redesign work.

That means:

- similar workspace rhythm,
- similar dark panel language,
- similar navigation feel,
- similar familiar controls where useful.

This does not mean keeping Nano architecture. The new app should still use:

- shared project memory,
- module folders,
- backend/API/worker separation,
- hidden provider/model routing.

## Order

1. Shared core and workspace shell
2. Main Nano-like base flow
3. `reframe`
4. `faceswap`
5. next module after stabilization
6. continue one by one

## Rule For Each Migration Slice

For each module:

1. copy the useful behavior and layout idea from Nano,
2. move it into the new folder structure,
3. replace local monolith state with shared Mulen state or a mock service,
4. keep provider logic behind internal services,
5. run `npm run typecheck`,
6. run `npm run build`,
7. verify in the in-app browser.

## First Real Port

The first real port should be the main Nano workspace area because it gives:

- the upload/generation rhythm,
- the familiar working surface,
- the quickest path to a usable `Photo Director` base.

Only after that should `reframe` and `faceswap` be brought over.
