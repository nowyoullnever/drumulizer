# Swing And Microtiming

Pattern Swing is stored on the Pattern and participates in Pattern Undo/Redo. It delays odd 16th-note steps only.

```ts
swingOffsetSteps = stepIndex % 2 === 1 ? (swing / 100) * (1 / 3) : 0;
```

Event Microtiming is stored as a fraction of one Step from `-0.45` to `+0.45`. The UI displays it as `-45%` to `+45%` and the effective value scales with BPM.

The scheduler combines Swing and Microtiming, then clamps the effective offset to `-0.45` to `+0.45` Step. Dynamic transport lead and schedule horizon account for early Events so negative Step-1 timing is prepared rather than silently lost.

This does not add triplet grid cells or move Event positions.
