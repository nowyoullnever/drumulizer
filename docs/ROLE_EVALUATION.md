# Role Evaluation

v0.5.0 adds `npm run test:slice-analysis`.

## Corpus

The deterministic generated corpus in `src/renderer/audio/sliceAnalysis/evaluation/generatedFixtures.ts` contains at least 18 synthetic slice categories. The fixtures cover low anchors, mid bodies, high clicks, noisy textures, hybrid material, quiet material, and clipping-warning material.

## Assertions

The focused test checks:

- raw feature values are finite and shaped correctly.
- lane scores and micro-role scores stay in `0..1`.
- lane scores remain independent rather than sum-to-one.
- representative low, high, texture, and unclassified cases are stable.
- override and exclusion semantics produce the expected effective role.

The corpus is a regression guard, not a claim of universal real-world drum classification accuracy.
