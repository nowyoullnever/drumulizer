# Edit History

Drumulizer v0.3.0 has a dedicated slice-edit history.

## Included Actions

- Add marker
- Move marker
- Delete marker
- Equal Divide
- Reset Markers

## Excluded Actions

- Selecting a slice
- Selecting a marker
- Seeking
- Playing or auditioning audio
- Changing master volume
- Changing language
- Zooming or panning the waveform

## Strategy

The history stores lightweight snapshots of marker arrays plus selected marker and selected slice IDs. It does not store decoded audio or waveform peak data.

## Drag Coalescing

During marker drag, preview updates are applied to the current visible editor state without pushing history entries. Pointer release creates one committed history entry.

## Limits

History keeps at most 100 past entries. A new edit clears redo history.

## Source Changes

Successful source replacement and source clearing reset history to a single full-file slice. Failed replacement preserves the previous marker history where practical.
