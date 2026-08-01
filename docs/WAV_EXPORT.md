# WAV Export

v0.9.0 exports stereo PCM WAV files. Supported bit depths are 16-bit and 24-bit. Supported sample rates are source sample rate from the current decoded source and the encoder supports 44.1kHz or 48kHz test fixtures.

The encoder writes RIFF/WAVE headers, `fmt ` PCM metadata, and interleaved stereo samples. Nonfinite values become silence. Values outside -1..1 are clipped and counted. Optional peak normalization is applied before encoding.

Output paths are chosen with native dialogs. Renderer prepares filenames and bytes but does not receive arbitrary filesystem write capability.
