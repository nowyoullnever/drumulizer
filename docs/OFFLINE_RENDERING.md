# Offline Rendering

Offline rendering uses the Sequencer voice planner shared with realtime scheduling. It evaluates Probability with the saved seed, Event id, and loop index. Swing, Microtiming, Ratchet, Reverse, and Granular voice expansion use the same event transform data as playback.

Seamless Loop renders one Pattern cycle. Performance Render renders a configurable number of cycles and may include tail time. Rendering writes Float32 stereo buffers, applies master/lane/event gain and pan, optionally normalizes peaks, then encodes PCM WAV.

Diagnostics report planned voices, duplicate voice keys, invalid source offsets, invalid audio times, skipped Probability Events, Granular fallbacks, clipping, peak, and duration. These are reproducibility and safety diagnostics, not musical-quality metrics.
