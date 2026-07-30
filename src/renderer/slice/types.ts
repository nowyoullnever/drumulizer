export type SliceMarkerOrigin = 'manual' | 'equal-division' | 'detected';

export interface SliceMarker {
  id: string;
  sampleIndex: number;
  origin: SliceMarkerOrigin;
}

export interface SliceBoundary {
  id: string;
  sampleIndex: number;
  fixed: boolean;
}

export interface SliceRegion {
  id: string;
  index: number;
  startSample: number;
  endSample: number;
  durationSamples: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  leftBoundaryId: string;
  rightBoundaryId: string;
}

export type WaveformTool = 'select' | 'add-marker';

export type SliceEditErrorCode =
  | 'NO_SOURCE'
  | 'MARKER_LIMIT'
  | 'MARKER_TOO_CLOSE'
  | 'DIVISION_INVALID'
  | 'DIVISION_TOO_DENSE'
  | 'FIXED_BOUNDARY';

export interface SliceEditResult {
  markers: SliceMarker[];
  selectedMarkerId: string | null;
  selectedSliceId: string;
  errorCode?: SliceEditErrorCode;
}

export interface SliceHistoryState {
  markers: SliceMarker[];
  selectedMarkerId: string | null;
  selectedSliceId: string;
}
