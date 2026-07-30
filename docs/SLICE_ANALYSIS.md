# Slice Analysis

Drumulizer v0.5.0 analyzes committed `SliceRegion[]`, not onset preview candidates. Analysis runs offline in `src/renderer/audio/sliceAnalysis/sliceAnalysis.worker.ts` using the imported source's analysis-only mono PCM.

## Lifecycle

- `unavailable`: no source is loaded.
- `not-analyzed`: a source and slice set exist, but no result exists for them.
- `analyzing`: a worker request is active.
- `ready`: result source id and slice-set signature match the current committed slices.
- `stale`: committed boundaries changed after the previous result.
- `error`: the worker failed.

## Raw Features

Each slice receives duration, RMS, peak, crest factor, clipping ratio, zero-crossing rate, attack, decay, early/tail energy, transient strength, band energy ratios, centroid, rolloff, flatness, entropy, spectral flux, high-frequency content, and pitch salience.

## Invalidation

Boundary edits, equal division, reset, onset apply, undo/redo boundary changes, source replacement, and source clear invalidate analysis and clear overrides/exclusions. Playback, audition, zoom, pan, language, selection, filtering, sorting, overrides, and exclusion changes do not invalidate analysis.
