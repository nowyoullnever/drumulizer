# Pattern Mutation

Mutation is a deterministic variation pass over the current Pattern. It uses the same local generator pipeline as Generate and Regenerate, with a mutation index appended to the Seed.

## Behavior

- `U` or Mutate Pattern creates the next mutation for the current Seed.
- Changing the Seed or generator settings resets the mutation index.
- Locked Events, Lane generation locks, and out-of-scope lanes are preserved.
- Manual Events remain protected in Preserve Manual Events mode.
- Changed generated Events are marked with the `mutated` origin.

## Amount

v0.7.0 exposes mutation amount through Breakage and Variation rather than a separate Amount control. Higher Breakage increases structural displacement and final-bar irregularity. Higher Variation increases slice and parameter diversity.

## History

Every changed mutation creates one undoable Pattern edit. No-op mutations, including fully protected Patterns, do not create history entries and report a no-change message.

## Limits

Mutation does not implement probability playback, microtiming, swing, ratchets, audio resynthesis, or project persistence.
