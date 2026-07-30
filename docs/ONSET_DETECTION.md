# Onset Detection

Drumulizer v0.4.0 includes a deterministic offline transient/onset detector. It is local DSP, not machine learning, not source separation, not BPM or beat detection, and not instrument classification.

## Input

The detector receives analysis-only mono PCM derived from the decoded local WAV or MP3 file. Full file paths are not exposed to the renderer UI, and no audio data leaves the local application.

## Preprocessing

- Replace non-finite samples with zero.
- Remove DC offset before analysis.
- Treat near-silent sources as a handled empty result.
- Downsample sources above 24kHz to 24kHz using windowed averaging.
- Choose a safe radix-2 frame size from the analysis sample rate.
- At 24kHz, use 512-sample frames and 128-sample hops.

Zero-length, near-zero-length, invalid sample-rate, silent, DC-offset, and non-finite inputs fail gracefully or return empty results.

## Spectral Analysis

Each frame uses a Hann window and radix-2 FFT. Positive magnitudes are log-compressed before spectral flux is measured. The detector evaluates low, low-mid, high-mid, and high frequency bands with precomputed bin ranges and frequency weights. A small band-energy floor reduces low-level noise inflation.

The dominant band is descriptive only. It is not kick/snare/hat detection and should not be used as instrument classification.

## Normalization

Novelty curves are normalized with blockwise robust local median/MAD statistics instead of per-frame full-window sorting. Neighboring blocks are smoothed so analysis remains stable while keeping allocation and sorting bounded for longer files.

## Envelope Features

The detector combines spectral novelty with:

- fast absolute-envelope rise
- slow envelope contrast
- low-frequency envelope rise

These features improve quiet transient, bass-heavy attack, and short high-click detection without adding a DSP dependency.

## Candidate Scoring

Candidate scoring uses multifeature transient evidence from spectral bands, broadband energy rise, high-frequency novelty, envelope features, and support count. Peaks must have finite prominence and enough transient support before they become preview candidates.

Post-processing includes:

- minimum-gap conflict resolution
- post-ring suppression after much stronger attacks
- crest-factor suppression for sustained tonal/ramped material
- dense-window suppression with a bounded candidate budget
- source-space onset refinement using short-time derivative and energy rise

All candidate samples are clamped to the source range. Candidate confidence is calibrated from score excess, prominence, attack evidence, and support count, then clamped between 0 and 1.

## Worker Lifecycle

Onset analysis runs in a bundled local worker. Requests carry an id, settings key, and generation guard. If the source changes, the source is cleared, settings change, or a newer analysis starts, stale progress/results/errors are ignored. Cancelling or unmounting terminates the worker client safely, and later analysis can create a fresh worker.

## Limitations

- Generated evaluation fixtures do not prove universal real-audio accuracy.
- Dense polyphonic material may still produce extra candidates.
- Very soft attacks can require higher sensitivity.
- Dominant band and support count are diagnostics only.
- HPSS, source separation, BPM detection, beat tracking, instrument labels, sequencer behavior, pattern generation, project saving, and audio export are deferred to later versions.
