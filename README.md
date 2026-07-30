# Drumulizer

Drumulizer is a Windows desktop application foundation for a future fully offline, sample-based IDM drum-loop generator. Version `0.1.0` establishes the Electron, React, TypeScript, Vite, security, visual, documentation, and workflow base.

Current status: foundation only. This version does not import, decode, analyze, slice, sequence, play, or export audio.

## Offline Principle

The packaged application must not require or attempt runtime network access. Drumulizer does not use telemetry, analytics, cloud AI, remote configuration, authentication, CDNs, remote fonts, remote images, or automatic updates.

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

## Planned Direction

Future versions will add local sample import, waveform playback, manual slicing, offline onset detection, slice role scoring, HPSS-derived slices, sequencing, IDM pattern generation, granular processing, project saves, and WAV/stem export.
