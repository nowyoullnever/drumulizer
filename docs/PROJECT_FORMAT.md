# Project Format

v0.9.0 introduces linked `.drumproj` files. A linked project is UTF-8 JSON with `format: "drumulizer-project"` and `schemaVersion: 1`.

Top-level fields include app version, stable project id, project name, timestamps, source descriptor, editor state, optional Slice analysis state, and Sequencer state. The source descriptor stores filename, extension, MIME type, byte length, SHA-256, decoded metadata, absolute path, and relative path where practical.

Persisted state includes committed markers, zero-crossing setting, equal-division value, onset settings, valid Slice analysis and annotations, normalized Pattern, Generator settings, IDM settings, mutation state, locks, Lane state, Event transforms, loop setting, and master gain.

Transient state is excluded: undo/redo history, drag state, selected preview candidate, workers, errors, waveform zoom, viewport, selected tabs, playhead, AudioNodes, and reverse cache.

Validation rejects unsupported schema versions, unsafe prototype keys, nonfinite numbers, invalid source metadata, malformed hashes, and impossible file sizes. Atomic writes use a temporary sibling file followed by rename.

Example:

```json
{
  "format": "drumulizer-project",
  "schemaVersion": 1,
  "projectName": "Synthetic Break",
  "source": {
    "fileName": "synthetic.wav",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reference": { "kind": "linked", "relativePath": "synthetic.wav" }
  }
}
```
