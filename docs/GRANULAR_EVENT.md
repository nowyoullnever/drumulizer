# Granular Event

Granular playback is selective and Event-based. It is not a continuous synthesizer, whole-Pattern effect, spectral processor, or granular workstation.

## Parameters

- Grain Size: 10-120ms.
- Grain Count: 2-8.
- Grain Position: 0-100% inside the Slice.
- Grain Spray: deterministic offset variation.
- Grain Pitch Jitter: deterministic per-grain pitch variation.

Grains are scheduled inside the Event or Ratchet trigger window. Every grain has a short fade envelope and gain normalization to keep overlapping grains bounded.

Very short Slices or trigger windows fall back to safe Slice playback.
