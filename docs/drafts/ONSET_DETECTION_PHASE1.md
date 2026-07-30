# Onset Detection Phase 1/2 Draft

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

## Phase 2 Updates

Phase 2 keeps the same offline architecture and adds quality, performance, and inspection improvements.

- Replace sliding full-window median/MAD normalization with blockwise robust local normalization.
- Reuse spectral frame and magnitude buffers during flux analysis.
- Precompute spectral band bin ranges and frequency weights.
- Use log-compressed spectral magnitudes and a minimum band-energy floor to reduce low-level noise inflation.
- Add fast envelope rise, slow envelope contrast, and low-frequency envelope rise features.
- Gate candidates with multi-feature transient evidence instead of broadband energy rise alone.
- Add crest-factor suppression for sustained tonal/ramped sources with low transient character.
- Suppress post-ring peaks shortly after much stronger attacks.
- Limit over-dense candidate sets by local relative strength and an 8 candidates/second dense budget.
- Calibrate confidence from score excess, prominence, attack evidence, and supporting feature count.
- Attach diagnostics for frame count, raw/gated/final candidates, density, strongest band, and dense suppression state.
- Show selected preview candidate details in the analysis panel.
- Support previous/next preview candidate navigation and short candidate audition.

## Phase 2 Evaluation Fixtures

The deterministic evaluation corpus covers isolated impulses, repeated impulses, kick-like low sine bursts, snare-like noise bursts, high-frequency clicks, alternating low/high attacks, quiet transients over low noise, gain-scaled patterns, sustained sine, gradual ramp, slow swells, sharp attack over ramp, dense polyphonic synthetic material, close attacks, silence, DC offset, and non-finite input.

Quality targets include finite clamped confidence, timing error under 25ms for expected hits, silence staying empty, ramp/swell candidate limits, dense-material candidate limits, gain stability, and fixture-specific recall/F1 thresholds.

## Deferred

HPSS, source separation, neural models, kick/snare/hat labels, BPM, beat-grid, sequencer, persistence, export, release packaging, and release screenshots are deferred.
