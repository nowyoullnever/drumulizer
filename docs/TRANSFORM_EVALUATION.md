# Transform Evaluation

v0.8.0 focused tests use generated fixtures and scheduler planning, not physical audio output.

## Covered Areas

- Probability determinism.
- Swing and Microtiming clamp behavior.
- Ratchet spacing and Decay.
- Reverse buffer preparation and cache hits.
- Granular grain planning and deterministic jitter.
- IDM Transform protection rules.
- Structural invariants: Lane, Step, and Slice assignment remain unchanged during IDM-only transforms.

## Guardrails

- Deterministic planning: 100%.
- Duplicate scheduled voice keys: 0.
- Invalid source offsets: 0 in focused fixtures.
- Locked Event modifications: 0.
- Locked Lane modifications: 0.
- Structural transform changes: 0.

These are regression guardrails, not musical-quality metrics.
