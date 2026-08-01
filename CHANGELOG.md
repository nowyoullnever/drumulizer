# Changelog

## [0.8.0] - 2026-08-01

### Added

- Deterministic per-loop Event Probability
- Pattern Swing and tempo-relative Event Microtiming
- One-to-four-trigger Event Ratchets with Velocity Decay
- Non-destructive reversed-Slice playback
- Selective Event-based Granular Burst playback
- Grain Size, Count, Position, Spray, and Pitch Jitter controls
- Deterministic IDM Transform and IDM mutation actions
- Automatic IDM transformation after Pattern generation
- Event transformation indicators and IDM Event Inspector controls
- Reverse-buffer cache and expanded scheduler evaluation
- Korean and English IDM transformation interface

### Changed

- Sequencer scheduling now supports early and late transformed Event times.
- Pattern generation can produce transformed IDM Events in one history action.

## [0.7.0] - 2026-07-30

### Added

- Deterministic role-aware Pattern Generator
- User-editable Pattern Seed
- Density, Variation, and Breakage controls
- Preserve Manual and Replace All Unlocked generation modes
- All-Lane and per-Lane generation scopes
- Pattern regeneration and bounded mutation
- Manual, Generated, and Mutated Event origins
- Event generation locks and Lane generation locks
- Generated Velocity, Pan, and playback-rate Pitch
- Generation diagnostics and deterministic evaluation corpus
- Robust staged Windows packaging workflow
- Korean and English Pattern Generator interface

### Changed

- Manual Event edits now take manual ownership of generated Events.
- Windows packaging now uses a unique staging directory to avoid fixed-output EPERM failures.
- Electron runtime updated to 43.2.0 so `npm audit --audit-level=moderate` reports zero vulnerabilities.

## [0.6.0] - 2026-07-30

- Added a manual four-lane LOW/MID/HIGH/TEXTURE sequencer with fixed 4/4 sixteenth-note grids, 1-4 bar patterns, and 40-240 BPM control.
- Added Slice Library to sequencer workflow with active-slice placement, select/paint/erase tools, event selection, event audition, and slice-reference reconciliation after source or slice edits.
- Added per-event velocity, pan, and pitch controls plus lane mute, solo, volume, clear-lane, clear-pattern, pattern undo, and pattern redo controls.
- Added a deterministic Web Audio look-ahead scheduling engine with loop-safe scheduling keys, bounded active voices, click-reducing event fades, and transport play/pause/stop/loop state.
- Added focused sequencer model, scheduler, and UI tests through `npm run test:sequencer`.
- Updated bilingual Korean/English UI copy, documentation, and version metadata for v0.6.0.

## [0.5.0] - 2026-07-30

- Added worker-based committed slice analysis for `SliceRegion[]` using local analysis-only mono PCM.
- Added raw slice DSP features, robust per-source normalization, micro-role scores, independent lane scores, automatic role, confidence, warnings, and generation recommendations.
- Replaced the disabled Pattern Workspace placeholder with a functional Slice Library including role filtering, sorting, selected-slice scoring, feature details, role distribution, overrides, and exclusion controls.
- Added role-aware Slice Map coloring and bilingual Korean/English UI copy for the new analysis and library surfaces.
- Added `test:slice-analysis` with a deterministic generated evaluation corpus.

## [0.4.0] - 2026-07-30

### Added

- Offline transient and onset detection
- Worker-based multiband spectral-flux analysis
- Fast, slow, and low-frequency transient envelopes
- Adaptive local normalization and peak selection
- Non-destructive onset candidate preview
- Candidate selection, navigation, and audition
- Replace and Merge marker application
- Candidate confidence and dominant-band diagnostics
- Deterministic onset evaluation corpus
- Korean and English onset-analysis interface

### Changed

- Improved analysis performance through blockwise robust normalization and reusable DSP buffers
- Improved quiet transient and bass-heavy attack detection
- Reduced false positives from gradual ramps, sustained tones, post-ring peaks, and dense material

## [0.3.0] - 2026-07-30

### Added

- Manual waveform slice markers
- Marker selection, dragging, and deletion
- Selected-slice highlighting and metadata
- Slice Map navigation
- Equal division presets and custom division
- Zero-crossing assistance
- Slice audition with short fades and optional pre-roll
- Slice edit Undo and Redo
- Korean and English slice-editor interface

## [0.2.0] - 2026-07-30

### Added

- Local WAV and MP3 import
- Native file dialog and drag-and-drop import
- Audio decoding and source metadata
- Mono and stereo waveform rendering
- Waveform zoom, pan, seek, and fit controls
- Play, pause, stop, loop, and master volume
- Local-only audio import architecture
- Waveform peak worker and playback tests
- Built-in Korean/English renderer localization with locale detection and persistence
- Single header app status module for ready, processing, and error states

### Changed

- Renderer import errors now localize stable error codes returned from main/preload and validation paths.
- Windows packaging disables electron-builder publishing with `--publish never`.
- Removed persistent offline badges and placeholder CPU/voices/cache metrics from the primary UI.

## [0.1.0] - 2026-07-30

### Added

- Initial Electron, React, TypeScript, and Vite foundation
- Fully offline runtime architecture
- Secure preload bridge
- Drumulizer visual system
- Bundled pixel font
- Reusable pixel UI components
- Windows build configuration
- Documentation and GitHub workflow
