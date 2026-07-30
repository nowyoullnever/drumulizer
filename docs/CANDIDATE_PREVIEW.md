# Candidate Preview

Onset candidates are non-destructive preview markers. They do not become slice markers until the user chooses Apply.

## Preview Behavior

- Preview candidates are separate from committed markers.
- The Slice Map and Undo history are unchanged until Apply.
- Preview markers stay aligned during waveform zoom and pan.
- The selected preview candidate is visually emphasized and drawn with a band-specific symbol.
- Dense candidate sets do not render a text label for every candidate.
- Discard clears the preview.
- Apply clears the preview after creating one history entry.
- Source replacement, source clear, sensitivity changes, and minimum-gap changes invalidate the preview.

## Selection And Navigation

Users can select a preview marker on the waveform, use Previous Candidate and Next Candidate buttons, or use comma and period shortcuts. These shortcuts are ignored inside text and number inputs.

Language switching preserves the loaded source, committed markers, preview candidates, and selected candidate.

## Candidate Audition

Candidate audition plays a short local region around the selected preview candidate: about 20ms before the candidate and about 120ms after it. The region is clamped to the source bounds, uses short gain fades, and schedules Web Audio start/stop times. Repeated candidate audition replaces the prior audition rather than overlapping.

Full-file playback, slice audition, and candidate audition are mutually exclusive.

## Diagnostics

The analysis panel shows:

- candidate number
- candidate time
- confidence
- dominant band
- supporting feature count
- candidate density
- strongest band

Confidence is a finite 0-1 score calibrated from detection evidence. Dominant band is descriptive only and is not drum-instrument classification.

## Apply Modes

Replace removes editable internal markers and applies detected markers with `origin: 'detected'`. Fixed source-start and source-end boundaries remain derived and are not stored as editable markers. Slice 1 becomes selected, and one Undo operation restores the complete prior marker set.

Merge preserves existing valid manual, equal-division, and detected markers. Conflicting candidates are skipped according to slice-duration rules, marker order remains sorted, applied/skipped counts are reported, and one Undo operation restores the complete prior state.

## Accessibility

Candidate navigation and audition controls are keyboard accessible. Previous/Next buttons expose disabled states. Preview markers have hit targets wider than their visual line. Band symbols and selection weight ensure the selected candidate is not indicated by color alone. Continuous waveform playhead movement is not announced as a live-region update.
