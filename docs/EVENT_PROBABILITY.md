# Event Probability

Event Probability is stored as `0-1` and displayed as `0-100%`.

## Playback

- `1` always triggers.
- `0` never triggers during Pattern playback.
- Intermediate values are evaluated once per Event per Pattern loop.
- Probability is evaluated before Ratchet or Granular expansion.
- Event audition ignores Probability and always plays.

## Determinism

The scheduler uses a deterministic key containing Seed, Event ID, loop index, and `probability`. Stop and Play restart loop decisions from loop 0. Pause and Resume preserve the current transport position and loop sequence.

No `Math.random()`, wall-clock time, frame count, or timer callback count participates in Probability.
