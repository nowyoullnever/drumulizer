# Slice Editor

Drumulizer v0.3.0 adds manual slice editing without automatic audio analysis.

## Marker Model

Editable markers are stored as integer sample indices:

```ts
interface SliceMarker {
  id: string;
  sampleIndex: number;
  origin: 'manual' | 'equal-division';
}
```

The decoded `AudioBuffer` is never mutated. Marker positions describe editor boundaries only.

## Fixed Boundaries

The source start and source end are implicit fixed boundaries:

- start: sample `0`
- end: exclusive source frame length

Users cannot drag or delete these boundaries.

## Slice Derivation

The editor sorts internal markers, adds the fixed source boundaries, and derives regions between adjacent boundaries. Slice IDs are derived from adjacent boundary IDs, keeping them reasonably stable when a marker moves. Displayed slice numbers are one-based.

No gaps or overlaps are allowed. A source with no internal markers produces one full-file slice.

## Constraints

- Minimum slice length: 5ms
- Maximum editable markers: 512
- Marker samples are finite, rounded integers inside the source range
- Dragging clamps a marker between adjacent boundaries while preserving minimum slice duration

Invalid marker edits show inline translated validation messages and do not place the whole app into permanent error state.

## Tools and Shortcuts

- Select: click slices or markers, drag editable markers, pan empty waveform space
- Add Marker: click waveform to add a marker
- `Alt + Click`: temporary marker add while in Select mode
- `M`: toggle Select/Add Marker
- Delete or Backspace: delete selected editable marker
- `[` and `]`: previous and next slice
- `A`: audition selected slice
- Escape: stop audition

Shortcuts are ignored while focus is inside text or numeric inputs.

## Equal Division

Equal Divide replaces all internal markers, preserves source start/end, uses integer sample positions, creates one undo entry, selects Slice 1, and marks all new markers as `equal-division`.

Presets: 4, 8, 16, 32 slices. Custom division accepts whole numbers from 2 to 128.

Zero-crossing assist is not applied to equal division; boundaries remain mathematically even.

## Zero-Crossing Assist

Zero-crossing assist uses the analysis-only mono data prepared during import. It performs no FFT, STFT, HPSS, onset detection, or transient detection.

When enabled for manual add or final drag commit:

1. Convert requested position to a sample index.
2. Search within plus/minus 5ms.
3. Prefer the nearest sign change.
4. If candidates are equally close, prefer lower surrounding amplitude.
5. If no sign change exists, use the nearest low-amplitude sample.
6. Revalidate minimum slice duration after snapping.

During drag, preview movement is unsnapped for smooth feedback; only pointer release commits the zero-crossing correction and creates one history entry.

## Source Replacement

Successful source replacement clears markers, selects one full-file slice, resets edit history, stops audition, and resets the waveform viewport. Failed replacement preserves the previous source, markers, selection, and history where practical.
