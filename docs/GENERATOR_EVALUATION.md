# Generator Evaluation

Generator regression coverage uses synthetic slice-analysis fixtures only. Tests do not need audio files, network services, model downloads, or filesystem media.

## Fixtures

`src/renderer/sequencer/generator/evaluation/fixtures.ts` defines deterministic committed slices and slice-analysis results for LOW, MID, HIGH, TEXTURE, weak fallback, excluded, invalid, and near-silent cases.

## Covered Risks

- Same Seed and settings produce the same Pattern hash.
- Different Seeds produce different deterministic output.
- Excluded, invalid, and near-silent Slices are rejected.
- Lane locks and Event locks are preserved.
- Manual ownership is preserved in Preserve Manual Events mode.
- Mutation advances deterministically and marks changed generated Events.
- UI controls expose Seed, Density, Variation, Breakage, Generation Mode, Generation Scope, Generate, Regenerate, Mutate, and lock actions.

## Commands

```powershell
npm run test:generator
npm run test:sequencer
npm run typecheck
```

The focused generator command is intended for local iteration and CI verification.
