# Waveform Rendering

Drumulizer v0.2.0 renders local audio waveforms with an internal Canvas implementation.

## Peak Generation

The renderer does not draw every sample. It builds min/max peak pairs at several target densities for efficient display. Silent and short audio are handled deterministically.

## Worker Use

Peak generation runs in a bundled local Web Worker created with `new Worker(new URL(..., import.meta.url), { type: 'module' })`. The worker is part of the local app bundle and is not fetched from a remote server.

## Resolution Strategy

The renderer keeps several peak levels and chooses the level whose seconds-per-peak best matches the visible seconds-per-pixel. This supports fit-to-window and moderate zoom without building a full DAW waveform engine.

## Canvas Rendering

The canvas is device-pixel-ratio aware. It draws a paper-toned background, center line, second ruler, mono or stacked stereo waveform, and a contrasting playhead. Dense textile patterns are not placed behind the waveform.

## Zoom and Pan

Fit shows the complete file. Zoom is clamped between 1x and 16x. Mouse-wheel zoom anchors near the pointer. Dragging pans horizontally while clamping the viewport inside the audio duration.

## Stereo Handling

Mono files render one lane. Stereo files render stacked left/right lanes. Multichannel files display the actual channel count in metadata and use the first two channels for waveform display while the analysis mono data averages all channels.
