# Role Scoring

Role scoring is heuristic local DSP for arranging support. It is not instrument naming, source separation, BPM detection, beat-grid analysis, or pattern generation.

## Normalization

Raw features are robustly normalized per source using percentile and median absolute deviation ranges. This keeps slices from the same imported source comparable without forcing global thresholds.

## Micro Roles

The analyzer computes independent `0..1` micro-role scores:

- `sub`
- `body`
- `crack`
- `tick`
- `noise`
- `tonal`
- `texture`
- `tail`
- `hybrid`

## Lane Scores

Lane scores are independent `0..1` values for `low`, `mid`, `high`, and `texture`. They are not probabilities and do not sum to one. The automatic primary role is the strongest lane unless the slice is too quiet or weakly scored, in which case it is `unclassified`.

## Effective Role

The effective role is automatic unless the user overrides it. Excluded slices resolve to `unclassified` for library filtering and future generation planning.
