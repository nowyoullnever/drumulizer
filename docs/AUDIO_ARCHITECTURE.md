# Audio Architecture

Drumulizer v0.2.0 uses the Web Audio API locally. No network audio source exists.

## AudioContext Lifecycle

The renderer lazily creates one shared `AudioContext` after a user gesture. The context is resumed before decoding or playback if it is suspended.

## Runtime Store

Decoded `AudioBuffer` objects and large `Float32Array` data stay in renderer runtime services, not JSON state. React receives lightweight metadata, import state, playback state, and waveform peak references.

## Decode Pipeline

Both native dialog import and drag-and-drop import normalize into the same local file result: file name, extension, MIME hint, size, and bytes. The renderer validates the input, decodes bytes with `decodeAudioData`, checks duration/channel constraints, and generates analysis-only mono data.

## Mono Mixdown

Mono data remains unchanged. Stereo is averaged as `(left + right) / 2`. Multichannel files average all available channels and clamp finite output into the valid audio range.

## Playback Graph

```text
AudioBufferSourceNode
        |
GainNode
        |
AudioContext.destination
```

Source nodes are recreated on play or seek. Repeated play does not create overlapping sources. Stop disconnects the active source and returns the cursor to zero.

## Playback Math

Playback position is derived from `AudioContext.currentTime`, source start context time, and source start offset. `requestAnimationFrame` updates the visual playhead only; it is not the authoritative audio clock.

## Loop Behavior

Loop mode uses the source node loop flag for full-file looping. Loop does not create slice markers or sequencer behavior.

## Cleanup

Replacing or clearing a source stops playback, disconnects source nodes, invalidates stale imports, clears waveform references, resets the cursor, and avoids keeping raw import bytes after successful decode.
