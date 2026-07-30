# Contributing

Drumulizer uses an Issue-first version workflow.

## Branches

Use descriptive branches such as `feature/v0.1.0-foundation` or `fix/v0.4.1-duplicate-onsets`.

## Commits

Use conventional commits:

- `feat(app): ...`
- `fix(renderer): ...`
- `docs(workflow): ...`
- `test(ui): ...`

Reference the GitHub Issue when the commit completes meaningful Issue scope.

## Required Checks

Run before opening or updating a Pull Request:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run build
```

Windows packaging changes must also run `npm run dist:win`.

## Offline Runtime

Do not add runtime network dependencies, telemetry, analytics, CDNs, remote fonts, remote images, remote configuration, authentication, license checks, or automatic updates.

## Visual System

Use centralized design tokens. Do not replace the visual system wholesale without an approved version Issue. New components should preserve pixel geometry, straight edges, visible focus, and the faded saturated print palette.

## Third-Party Assets

Add only assets that can be bundled locally. Copy the applicable license into the repository and document the asset in `THIRD_PARTY_LICENSES.md`.
