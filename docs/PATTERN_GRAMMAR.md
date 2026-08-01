# Pattern Grammar

The v0.7.0 generator uses a deterministic local rule grammar over the existing Sequencer grid. It does not infer tempo, beat grids, swing, genre, or musical intent from the source file.

## Grid

- 16 steps per bar.
- 1-4 bars.
- LOW, MID, HIGH, and TEXTURE lanes.
- One Event per lane and step.

## Lane Intent

- LOW favors downbeats and strong anchors.
- MID favors backbeat positions.
- HIGH favors even eighth and sixteenth motion.
- TEXTURE favors sparse pickups and end-of-bar gestures.

Each lane has a base motif list and an extra-step list. Density controls approximate Event count. Variation controls bar diversity, slice diversity, and parameter spread. Breakage can omit noncritical anchors, displace steps by one sixteenth, and add final-bar irregularity.

## Determinism

All stochastic choices use `createPrng(seed)` from `src/renderer/sequencer/generator/prng.ts`. Grammar code must not use `Math.random()`, wall-clock time, playback state, network data, or object iteration order as a random source.

## Output

The grammar only plans lane/step positions. Slice choice, velocity, pan, pitch, lock preservation, and summary reporting are handled by the generator pipeline.
