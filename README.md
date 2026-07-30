# Drumulizer

Drumulizer is a Windows desktop application for building a fully local, sample-based IDM drum-loop workflow. Version `0.2.0` adds local WAV/MP3 import, decoding, waveform display, navigation, and basic playback on top of the v0.1.0 foundation.

Current status: audio workspace. This version imports, decodes, displays, navigates, and plays local audio files. It does not analyze, slice, sequence, generate patterns, or export audio.

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
- `npm run build`: build production main, preload, and renderer assets.
- `npm run dist:win`: create Windows distributables with electron-builder.

## Windows Build

Run:

```powershell
npm run dist:win
```

Build outputs are written to `release/` and ignored by Git.

## Repository Workflow

Version work begins with a GitHub Issue, proceeds on a feature branch, and lands through a Pull Request into `main`. Use conventional commits and reference the version Issue in relevant commits and PRs.

The CI workflow runs install, lint, formatting check, type checking, tests, production build, and Windows packaging verification.

`npm run dist:win` passes `--publish never` to electron-builder so local and CI packaging cannot attempt release publishing or require `GH_TOKEN`.

## Interface Localization

The renderer includes internal Korean and English dictionaries, detects the initial locale from `navigator.language`, and persists the user's language choice in local storage. UI copy and user-facing import errors are resolved through the renderer `t()` helper; main/preload code returns stable error codes rather than localized messages.

The primary header contains one noninteractive app status module with `ready`, `processing`, and `error` states. Legacy offline badges and placeholder system metrics are not shown in the main UI.

## Planned Direction

Future versions will add manual slicing, offline onset detection, slice role scoring, HPSS-derived slices, sequencing, IDM pattern generation, granular processing, project saves, and WAV/stem export.
