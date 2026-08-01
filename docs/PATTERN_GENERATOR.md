# Pattern Generator

Drumulizer v0.7.0 adds a deterministic local rule-based Pattern Generator. It is not AI, not machine learning, and does not use network services. The generator produces ordinary Sequencer Events that play through the existing Web Audio scheduler.

## Prerequisites

Generation requires a loaded source, committed slices, current Slice analysis matching the current slice-set signature, at least one eligible nonexcluded Slice, and stopped Pattern transport. Stale analysis disables Generate, Regenerate, and Mutate.

## Settings

- Seed: visible compact string normalized by `normalizeSeed`.
- Density: approximate Event count.
- Variation: bar diversity, Slice diversity, Velocity, Pan, Pitch, and mutation breadth.
- Breakage: structural irregularity on the fixed 16th grid.
- Generation Mode: Preserve Manual Events or Replace All Unlocked.
- Generation Scope: All Lanes or one of LOW, MID, HIGH, TEXTURE.

## Slice Pools

Lane pools use Slice lane scores, effective role including overrides, confidence, warnings, recommendation, duration, and recent-use penalties. Excluded, invalid, and near-silent Slices are not generated automatically. Weak fallback is reported by summary data and never treated as perfect.

## Ownership And Locks

Events carry `manual`, `generated`, or `mutated` origin plus a lock flag. Manual edits claim manual ownership. Event locks and Lane generation locks protect useful work from Generate, Regenerate, and Mutate while leaving manual stopped-state editing available.

## Limits

v0.7.0 does not implement probability playback, Swing, microtiming, ratchets, granular synthesis, project persistence, export, BPM detection, or beat tracking.
