# Slice Audition

Slice audition is a local one-shot preview of the selected slice.

## Behavior

- Starts at the selected slice start
- Optional pre-roll begins before the slice where possible
- Stops at the selected slice end plus any pre-roll duration
- Does not loop
- Uses the original decoded audio
- Does not alter marker positions or PCM samples
- Prevents overlapping audition nodes

Starting Audition stops any previous audition first. Starting full-file playback stops slice audition. Starting slice audition stops full-file playback.

## Audio Graph

```text
AudioBufferSourceNode
        |
Audition GainNode
        |
Master GainNode
        |
AudioContext.destination
```

The master gain node remains shared with full-file transport where practical.

## Fades

Audition applies 3ms fade-in and 3ms fade-out by default. Fade duration is clamped so it never exceeds 25% of the selected slice duration.

Fades use gain automation. PCM samples and marker positions are not changed.

## Pre-Roll

Pre-roll range is 0ms to 50ms. Presets are 0, 5, 10, 20, and 50ms.

Pre-roll never begins before sample 0 and does not change displayed slice start metadata.

## Cleanup

Replacing or clearing a source stops audition and disconnects nodes. Moving or deleting a boundary that can affect the selected slice also stops audition safely.
