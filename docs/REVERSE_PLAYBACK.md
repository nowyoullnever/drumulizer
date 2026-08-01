# Reverse Playback

Reverse playback does not modify the original source PCM and does not use negative playback rate. Drumulizer prepares a Slice-specific reversed AudioBuffer.

## Cache

The cache key includes source identity, Slice ID, start sample, end sample, channel count, and sample rate. Cache limits are bounded by entry count and approximate PCM memory.

The cache is cleared on source replacement and app cleanup. Evicted buffers may be regenerated.

## Playback

Reverse supports Velocity, Pan, Pitch playback rate, Ratchet, Granular mode, fades, Lane Volume, Mute, and Solo. If preparation fails, the affected voice is skipped rather than crashing the Pattern.
