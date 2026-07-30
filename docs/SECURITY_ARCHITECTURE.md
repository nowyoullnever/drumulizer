# Security Architecture

Drumulizer uses separated Electron processes.

- Main process owns windows and runtime security policy.
- Preload exposes a narrow typed bridge.
- Renderer has no direct Node.js access.
- Shared code contains serializable types and constants only.

## BrowserWindow Defaults

The main window uses:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`

The preload bridge exposes only `window.drumulizer.getAppInfo()` and `window.drumulizer.selectLocalAudioFile()`. The audio file operation is a narrow IPC request: main owns the native file dialog, accepts one local WAV or MP3 file, validates file type and size, reads bytes, and returns serializable metadata plus an `ArrayBuffer`.

## Navigation and Permissions

Arbitrary navigation is blocked. New windows are denied. Permission requests are denied by default. Webviews are blocked. Electron remote modules are not used.

## Secrets

The renderer is not given `require`, `process`, shell execution, unrestricted IPC, environment variables, arbitrary file paths, or filesystem functions.

Future local file APIs must be designed as narrow IPC operations with validated inputs and explicit return types.
