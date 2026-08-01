# Stem Export

Stem export writes LOW, MID, HIGH, and TEXTURE lane WAV files. Each stem uses the same Pattern duration, seed, output sample rate, bit depth, and render mode as the mix.

Mute and Solo rules are inherited from the Pattern planner. Mix-and-stems export writes the stereo mix plus each Lane stem in one directory selection. The implementation uses shared planning so Probability decisions are consistent for the same seed and loop index.

Stems are intended for timing-aligned local editing. Exact floating-point summability can differ after independent WAV quantization.
