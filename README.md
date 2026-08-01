# Drumulizer

Drumulizer is a Windows desktop application for building a fully local, sample-based IDM drum-loop workflow. Version `0.7.0` adds a deterministic, rule-based Pattern Generator that uses current Slice analysis and role-suitability scores to generate, regenerate, and mutate LOW/MID/HIGH/TEXTURE sequencer patterns.

Current status: local audio slice workspace with manual editing, offline onset assistance, slice analysis, Slice Library curation, manual pattern playback, Seed-reproducible Pattern generation, Density/Variation/Breakage controls, Event locks, Lane generation locks, and manual-event preservation. It does not use AI, machine learning, automatic drum classification, BPM detection, probability playback, project saving, MIDI, or audio export.

## Offline Principle

The packaged application must not require or attempt runtime network access. Drumulizer does not use URL import, telemetry, analytics, cloud AI, remote configuration, authentication, CDNs, remote fonts, remote images, or automatic updates. Audio enters only from a user-selected local WAV or MP3 file.

## Development

Requirements:

- Windows 10 or Windows 11
- Node.js LTS
- npm

Setup:

```powershell
npm ci
npm run dev
```

## Commands

- `npm run dev`: start Electron with the local Vite renderer.
- `npm run lint`: run ESLint.
- `npm run format`: format files with Prettier.
- `npm run format:check`: verify formatting.
- `npm run typecheck`: run strict TypeScript checks.
- `npm run test`: run Vitest in watch mode.
- `npm run test:run`: run Vitest once for CI.
- `npm run test:onset`: run focused onset-analysis tests.
- `npm run verify:onset`: run typecheck and focused onset-analysis tests.
- `npm run test:sequencer`: run focused sequencer model, scheduling, and UI tests.
- `npm run test:generator`: run focused PRNG, generator, grammar, mutation, evaluation, and generator UI tests.
- `npm run build`: build production main, preload, and renderer assets.
- `npm run dist:win`: create Windows distributables with electron-builder.

## Windows Build

Run:

```powershell
npm run dist:win
```

Build outputs are staged in a unique temporary directory, smoke-checked from the staged unpacked app, then copied to stable `release/` and `outputs/` paths. Packaging uses `--publish never`, so it must not create a GitHub Release, upload artifacts, or require `GH_TOKEN`.

## Repository Workflow

Version work begins with a GitHub Issue, proceeds on a feature branch, and lands through a Pull Request into `main`. Use conventional commits and reference the version Issue in relevant commits and PRs.

The CI workflow runs install, lint, formatting check, type checking, tests, production build, and Windows packaging verification.

## Interface Localization

The renderer includes internal Korean and English dictionaries, detects the initial locale from `navigator.language`, and persists the user's language choice in local storage. UI copy and user-facing import or analysis errors are resolved through the renderer `t()` helper; main/preload code returns stable error codes rather than localized messages.

The primary header contains one noninteractive app status module with `ready`, `processing`, and `error` states. Legacy offline badges and placeholder system metrics are not shown in the main UI.

## Manual Slice Editing

Slice markers are stored as integer sample indices and are derived into non-overlapping slice regions between fixed source-start and source-end boundaries. Users can add markers, select and drag them, delete editable markers, reset all markers, equal-divide the source into preset or custom slice counts, use zero-crossing assist for manual edits, and undo or redo slice edits.

Selected-slice audition uses the original decoded audio, scheduled Web Audio start/stop, short non-destructive gain fades, and optional pre-roll. It does not loop and does not alter marker positions.

## Offline Onset Analysis

The v0.4.0 detector runs locally in a renderer worker. It uses deterministic multiband spectral flux, adaptive blockwise normalization, transient envelope features, peak selection, dense-material suppression, and source-space onset refinement. The detector creates preview candidates only; committed slice markers do not change until the user applies the preview.

The v0.5.0 slice analyzer runs locally in a renderer worker against committed `SliceRegion[]`. It computes raw DSP features, robust per-source normalization, micro-role scores, independent low/mid/high/texture lane scores, automatic primary role, confidence, warnings, and generation recommendations. The Slice Library can filter, sort, inspect, override, and exclude slices without changing marker boundaries.

The v0.6.0 sequencer introduced manual event placement. v0.7.0 adds a deterministic local Pattern Generator on top of the same LOW/MID/HIGH/TEXTURE grid. Users can generate, regenerate unlocked material, mutate by Seed, lock Events or Lanes, edit per-event velocity, pan, and pitch, and play the result with a Web Audio look-ahead scheduler. Patterns remain fixed 4/4 sixteenth-note grids from 1 to 4 bars at 40-240 BPM. The sequencer still does not detect tempo, infer beats, or use network generation.

The v0.7.0 Pattern Generator requires current Slice analysis. It normalizes the visible Seed, uses an internal deterministic PRNG, builds lane-specific weighted Slice pools, applies lane grammar, and produces ordinary Sequencer Events with `manual`, `generated`, or `mutated` origin. Generate preserves manual Events by default, Regenerate can replace unlocked Events, and Mutate advances a deterministic mutation index. Event locks and Lane generation locks protect useful work while manual editing remains available when transport is stopped.

Preview candidates can be selected on the waveform, navigated with Previous/Next buttons or `,` and `.` shortcuts, and auditioned with a short 20ms pre-roll and 120ms post window. Candidate confidence, dominant band, and supporting feature count are shown as diagnostics, not as instrument labels.

Replace mode substitutes editable internal markers with detected markers. Merge mode preserves existing valid manual, equal-division, and detected markers while skipping candidates that conflict with slice-duration rules. Each apply operation creates one undoable history entry.

## Planned Direction

Future versions will add HPSS-derived slices, granular processing, project saves, and WAV/stem export.
