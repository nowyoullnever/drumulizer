# IDM Transform

v0.8.0 adds deterministic IDM Transform actions that decorate existing Sequencer Events. The transform engine changes Event playback parameters only; it does not change Lane, Step, Slice assignment, Pattern length, BPM, or slice boundaries.

## Settings

- Seed: normalized deterministic string.
- Intensity: 0-100.
- Mode: Preserve Manual Events or Replace All Unlocked.
- Scope: All Lanes or one Lane.
- Feature toggles: Probability, Timing, Ratchet, Reverse, Granular.
- Apply After Generation: decorates generated Patterns in the same history action.

## Actions

- Apply IDM: deterministic transform pass from the current Seed.
- Mutate IDM: deterministic next mutation from Seed plus mutation index.
- Reset IDM: resets unprotected Events to default transform values.

Event locks and Lane generation locks are always preserved. In Preserve Manual Events mode, manual Events are preserved. In Replace All Unlocked mode, unlocked manual Events may be transformed.

## Limits

IDM Transform is not AI, machine learning, Markov generation, arrangement, project persistence, or export.
