# Windows Packaging

`npm run dist:win` builds the app, packages a Windows build in a unique temporary staging directory, smoke-launches the staged executable, then copies distributable artifacts to `release/` and `outputs/`.

## Scripts

- `npm run dist:win`: production Windows packaging path.
- `npm run dist:win:builder`: direct `electron-builder` fallback with `--publish never`.
- `scripts/package-windows.mjs`: staging, smoke launch, artifact copy, and cleanup wrapper.

## Smoke Launch

The packaging wrapper looks for `win-unpacked/Drumulizer.exe`, starts it, waits briefly, and treats a still-running process as a successful launch. A nonzero early exit fails the command.

## Publishing

CI and local packaging use `--publish never`. v0.9.0 does not create GitHub Releases automatically.

## Outputs

The release directories are build artifacts and remain ignored by Git. The script creates them when packaging succeeds.
