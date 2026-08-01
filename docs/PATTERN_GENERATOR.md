# Pattern Generator

Drumulizer v0.7.0 added a deterministic local rule-based Pattern Generator. v0.8.0 can automatically decorate generated Events with deterministic IDM transforms when Apply After Generation is enabled. It is not AI, not machine learning, and does not use network services.

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

v0.8.0 implements Event Probability, Swing, Microtiming, Ratchet, Reverse, and selective Event-based Granular Burst playback. v0.9.0 persists Generator and IDM settings in projects and uses the same Seed values for deterministic offline render decisions. It still does not implement BPM detection, beat tracking, continuous granular synthesis, or master effects.
