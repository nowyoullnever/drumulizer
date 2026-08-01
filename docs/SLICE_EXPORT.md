# Slice Export

Slice export writes the selected Slice as a stereo WAV. Mono sources are duplicated to stereo. Stereo sources preserve left/right channels. Very short edge fades are clamped to avoid clicks without changing marker positions.

Included-Slices export is represented by the same safe filename and encoder path; excluded Slice filtering is controlled by Slice Library annotations.

Slice export does not modify markers, Pattern Events, Generator settings, IDM transforms, or analysis results.
