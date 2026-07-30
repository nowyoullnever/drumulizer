# Onset Detection Phase 1 Draft

Phase 1 implements a local, deterministic transient candidate detector. It does not apply candidates automatically.

## Algorithm

- Copy analysis-only mono PCM for worker transfer.
- Remove DC offset and replace non-finite samples with zero.
- Treat near-silent sources as a handled empty result.
- Downsample sources above 24kHz to 24kHz using windowed averaging.
- Use Hann-windowed radix-2 FFT frames.
- At 24kHz, use 512-sample frames and 128-sample hops.
- Measure positive spectral flux in low, low-mid, high-mid, and high bands.
- Add broadband RMS energy rise and high-frequency-weighted novelty.
- Normalize novelty curves with local median/MAD statistics over about 350ms.
- Combine normalized curves with centralized weights.
- Map sensitivity 0-100 to threshold multiplier 3.2-0.9.
- Pick finite local maxima and resolve minimum-gap conflicts by score.
- Refine candidate positions in original sample space using short-time derivative/energy rise, then shift about 2ms earlier.

## Initial Weights

- low: 0.15
- low-mid: 0.20
- high-mid: 0.25
- high: 0.20
- energy rise: 0.10
- high-frequency novelty: 0.10

## Known Weaknesses

- Gradual ramps can still produce a few candidates at high sensitivity.
- Very dense polyphonic material may require Phase 2 tuning.
- Dominant band is descriptive only and is not drum-instrument classification.

## Deferred

HPSS, source separation, neural models, kick/snare/hat labels, BPM, beat-grid, sequencer, persistence, export, release packaging, and release screenshots are deferred.
