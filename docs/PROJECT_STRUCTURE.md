# Project Structure

## v0.5.0 Additions

- `src/renderer/audio/sliceAnalysis/`: committed-slice feature extraction, normalization, role scoring, worker, and worker client.
- `src/renderer/audio/sliceAnalysis/evaluation/`: deterministic generated slice-role fixtures.
- `src/renderer/components/SliceLibraryPanel.tsx`: role filtering, sorting, inspection, override, and exclusion UI.
- `src/renderer/tests/sliceAnalysis.test.ts`: focused slice analysis regression coverage.

## v0.7.0 Additions

- `src/renderer/sequencer/generator/`: deterministic PRNG, rhythm grammar, slice pools, generation, mutation, diagnostics, and evaluation fixtures.
- `src/renderer/tests/*generator*.test.ts*`, `grammar.test.ts`, `mutation.test.ts`, and `prng.test.ts`: focused generator regression coverage.
- `scripts/package-windows.mjs`: staged Windows packaging, smoke launch, artifact copy, and cleanup wrapper.
- `docs/PATTERN_GENERATOR.md`, `docs/PATTERN_GRAMMAR.md`, `docs/PATTERN_MUTATION.md`, `docs/GENERATOR_EVALUATION.md`, and `docs/WINDOWS_PACKAGING.md`: v0.7.0 feature and release documentation.

```text
src/
  main/                 Electron app lifecycle, BrowserWindow, and security policy
  preload/              Narrow typed bridge exposed through contextBridge
  renderer/             React application, audio services, slice editor, i18n, components, styles, tests, and assets
  renderer/audio/onset  Offline onset detector, worker client, DSP helpers, and evaluation fixtures
  renderer/sequencer    Pattern model, scheduler, generator, mutation, and sequencer types
  renderer/slice        Slice model, constraints, zero-crossing logic, and edit history
  shared/               Runtime-free constants and serializable types
docs/                   Architecture, design, offline, onset, localization, and versioning documentation
.github/                Issue, Pull Request, and CI workflow files
build/                  Packaging resources
scripts/                Development-only helpers and benchmarks
```

Rules:

- Main process code must not be imported by the renderer.
- Renderer code must not access Node.js directly.
- Shared modules must not depend on Electron runtime modules.
- Preload APIs must remain narrow and typed.
- Future audio/file APIs must validate inputs and avoid unrestricted filesystem exposure.
- Audio runtime code lives in `src/renderer/audio/`; large decoded objects stay outside serializable metadata.
- Onset analysis code lives in `src/renderer/audio/onset/` and must remain deterministic, local, and dependency-light.
- Slice editor model, constraints, zero-crossing logic, and edit history live in `src/renderer/slice/`.
- Pattern generation must stay inside `src/renderer/sequencer/generator/` and must not import Electron, Node runtime modules, network clients, or audio playback services.
- Renderer-localized copy lives in `src/renderer/i18n/`; main/preload should return stable codes for user-facing failures.
