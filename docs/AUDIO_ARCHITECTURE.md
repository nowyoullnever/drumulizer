# Audio Architecture

Drumulizer v0.4.0 uses the Web Audio API and local renderer workers. No network audio source exists.

## v0.5.0 Slice Analysis

Slice analysis uses the same local analysis-only mono PCM created during import. The renderer sends committed `SliceRegion[]` and a slice-set signature to `sliceAnalysis.worker.ts`; onset preview candidates are not analyzed. Results return to the renderer as raw features, normalized features, micro-role scores, lane scores, automatic role, confidence, warnings, and recommendations.

## AudioContext Lifecycle

The renderer lazily creates one shared `AudioContext` after a user gesture. The context is resumed before decoding, full-file playback, slice audition, or candidate audition if it is suspended.

## Runtime Store

Decoded `AudioBuffer` objects and large `Float32Array` data stay in renderer runtime services, not JSON state. React receives lightweight metadata, import state, playback state, waveform peak references, and onset-preview summaries.

## Decode Pipeline

Both native dialog import and drag-and-drop import normalize into the same local file result: file name, extension, MIME hint, size, and bytes. The renderer validates the input, decodes bytes with `decodeAudioData`, checks duration/channel constraints, and generates analysis-only mono data.

## Mono Mixdown

Mono data remains unchanged. Stereo is averaged as `(left + right) / 2`. Multichannel files average all available channels and clamp finite output into the valid audio range. Non-finite PCM is sanitized before onset analysis.

## Playback Graph

```text
AudioBufferSourceNode
        |
GainNode
        |
AudioContext.destination
```

Source nodes are recreated on play or seek. Repeated play does not create overlapping sources. Stop disconnects the active source and returns the cursor to zero.

## Audition Graph

```text
AudioBufferSourceNode
        |
Audition GainNode
        |
Master GainNode
        |
AudioContext.destination
```

Slice audition starts from the selected slice start, optionally minus clamped pre-roll, and schedules `start()` and `stop()` with Web Audio times. Candidate audition plays about 20ms before the selected preview candidate and about 120ms after it, clamped to the source bounds. The renderer does not use JavaScript timers as the authoritative stop mechanism. A short gain fade is automated on the audition gain node and clamped to 25% of the audition duration.

Starting full-file playback stops audition. Starting slice audition or candidate audition stops full-file playback and any previous audition. Repeated audition requests replace the active audition node rather than overlapping.

## Onset Analysis Worker

Onset analysis runs in a bundled local Web Worker. Requests carry a generation id and settings key; stale worker results, stale progress, and stale errors are ignored if a newer analysis, source replacement, source clear, or settings change occurred. Worker cancellation and unmount cleanup terminate the active worker client safely.

The detector is deterministic and local. It does not use machine learning, source separation, BPM detection, beat tracking, or instrument classification.

## Playback Math

Playback position is derived from `AudioContext.currentTime`, source start context time, and source start offset. `requestAnimationFrame` updates the visual playhead only; it is not the authoritative audio clock.

## Loop Behavior

Loop mode uses the source node loop flag for full-file looping. Loop does not create slice markers or sequencer behavior.

## Cleanup

Replacing or clearing a source stops playback and audition, disconnects source nodes, invalidates stale imports and onset previews, clears waveform references, resets the cursor, resets slice markers/history, and avoids keeping raw import bytes after successful decode. Failed replacement preserves the previous decoded source and slice edit state.
