# Project Structure

## v0.5.0 Additions

- `src/renderer/audio/sliceAnalysis/`: committed-slice feature extraction, normalization, role scoring, worker, and worker client.
- `src/renderer/audio/sliceAnalysis/evaluation/`: deterministic generated slice-role fixtures.
- `src/renderer/components/SliceLibraryPanel.tsx`: role filtering, sorting, inspection, override, and exclusion UI.
- `src/renderer/tests/sliceAnalysis.test.ts`: focused slice analysis regression coverage.

```text
src/
  main/                 Electron app lifecycle, BrowserWindow, and security policy
  preload/              Narrow typed bridge exposed through contextBridge
  renderer/             React application, audio services, slice editor, i18n, components, styles, tests, and assets
  renderer/audio/onset  Offline onset detector, worker client, DSP helpers, and evaluation fixtures
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
- Renderer-localized copy lives in `src/renderer/i18n/`; main/preload should return stable codes for user-facing failures.
