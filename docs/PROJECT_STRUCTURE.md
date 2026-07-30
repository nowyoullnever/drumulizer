# Project Structure

```text
src/
  main/       Electron app lifecycle, BrowserWindow, and security policy
  preload/    Narrow typed bridge exposed through contextBridge
  renderer/   React application, audio services, components, styles, tests, and assets
  shared/     Runtime-free constants and serializable types
docs/         Architecture, design, offline, and versioning documentation
.github/      Issue, Pull Request, and CI workflow files
build/        Packaging resources
```

Rules:

- Main process code must not be imported by the renderer.
- Renderer code must not access Node.js directly.
- Shared modules must not depend on Electron runtime modules.
- Preload APIs must remain narrow and typed.
- Future audio/file APIs must validate inputs and avoid unrestricted filesystem exposure.
- v0.2.0 audio runtime code lives in `src/renderer/audio/`; large decoded objects stay outside serializable metadata.
