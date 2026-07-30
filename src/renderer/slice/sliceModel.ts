import { MAX_SLICE_MARKERS, MIN_SLICE_DURATION_MS } from '../../shared/constants/slice';
import type {
  SliceBoundary,
  SliceEditErrorCode,
  SliceEditResult,
  SliceMarker,
  SliceMarkerOrigin,
  SliceRegion,
} from './types';
import { snapToZeroCrossing } from './zeroCrossing';

export const sourceStartBoundaryId = 'source-start';
export const sourceEndBoundaryId = 'source-end';

export const minimumSliceSamples = (sampleRate: number): number =>
  Math.max(1, Math.ceil((sampleRate * MIN_SLICE_DURATION_MS) / 1000));

export const createMarkerId = (sampleIndex: number, origin: SliceMarkerOrigin): string =>
  `${origin}-${sampleIndex.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeMarkers = (
  markers: SliceMarker[],
  sourceLengthSamples: number,
): SliceMarker[] =>
  markers
    .filter(
      (marker) =>
        Number.isFinite(marker.sampleIndex) &&
        marker.sampleIndex > 0 &&
        marker.sampleIndex < sourceLengthSamples,
    )
    .map((marker) => ({ ...marker, sampleIndex: Math.round(marker.sampleIndex) }))
    .sort((left, right) => left.sampleIndex - right.sampleIndex || left.id.localeCompare(right.id));

export const deriveBoundaries = (
  markers: SliceMarker[],
  sourceLengthSamples: number,
): SliceBoundary[] => [
  { id: sourceStartBoundaryId, sampleIndex: 0, fixed: true },
  ...normalizeMarkers(markers, sourceLengthSamples).map((marker) => ({
    id: marker.id,
    sampleIndex: marker.sampleIndex,
    fixed: false,
  })),
  { id: sourceEndBoundaryId, sampleIndex: sourceLengthSamples, fixed: true },
];

export const deriveSlices = (
  markers: SliceMarker[],
  sourceLengthSamples: number,
  sampleRate: number,
): SliceRegion[] => {
  const boundaries = deriveBoundaries(markers, sourceLengthSamples);
  const slices: SliceRegion[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const left = boundaries[index];
    const right = boundaries[index + 1];
    const durationSamples = Math.max(0, right.sampleIndex - left.sampleIndex);
    slices.push({
      id: `${left.id}->${right.id}`,
      index,
      startSample: left.sampleIndex,
      endSample: right.sampleIndex,
      durationSamples,
      startSeconds: left.sampleIndex / sampleRate,
      endSeconds: right.sampleIndex / sampleRate,
      durationSeconds: durationSamples / sampleRate,
      leftBoundaryId: left.id,
      rightBoundaryId: right.id,
    });
  }
  return slices;
};

export const findSliceBySample = (slices: SliceRegion[], sampleIndex: number): SliceRegion | null =>
  slices.find((slice) => sampleIndex >= slice.startSample && sampleIndex < slice.endSample) ??
  slices.at(-1) ??
  null;

export const findSliceAfterBoundary = (
  slices: SliceRegion[],
  boundaryId: string,
): SliceRegion | null => slices.find((slice) => slice.leftBoundaryId === boundaryId) ?? null;

const boundarySampleIndexes = (markers: SliceMarker[], sourceLengthSamples: number): number[] =>
  deriveBoundaries(markers, sourceLengthSamples).map((boundary) => boundary.sampleIndex);

export const validateMarkerSample = (
  markers: SliceMarker[],
  sampleIndex: number,
  sourceLengthSamples: number,
  sampleRate: number,
  movingMarkerId?: string,
): SliceEditErrorCode | null => {
  const minSamples = minimumSliceSamples(sampleRate);
  if (sampleIndex < minSamples || sampleIndex > sourceLengthSamples - minSamples) {
    return 'MARKER_TOO_CLOSE';
  }
  const otherMarkers = movingMarkerId
    ? markers.filter((marker) => marker.id !== movingMarkerId)
    : markers;
  return boundarySampleIndexes(otherMarkers, sourceLengthSamples).some(
    (boundary) => Math.abs(boundary - sampleIndex) < minSamples,
  )
    ? 'MARKER_TOO_CLOSE'
    : null;
};

export const addMarker = (input: {
  markers: SliceMarker[];
  requestedSample: number;
  sourceLengthSamples: number;
  sampleRate: number;
  analysisMonoData?: Float32Array;
  zeroCrossingEnabled: boolean;
}): SliceEditResult => {
  if (input.sourceLengthSamples <= 0) {
    return {
      markers: input.markers,
      selectedMarkerId: null,
      selectedSliceId: '',
      errorCode: 'NO_SOURCE',
    };
  }
  if (input.markers.length >= MAX_SLICE_MARKERS) {
    const slices = deriveSlices(input.markers, input.sourceLengthSamples, input.sampleRate);
    return {
      markers: input.markers,
      selectedMarkerId: null,
      selectedSliceId: slices[0]?.id ?? '',
      errorCode: 'MARKER_LIMIT',
    };
  }

  const requested = Math.round(input.requestedSample);
  const snapped = input.zeroCrossingEnabled
    ? snapToZeroCrossing({
        requestedSample: requested,
        sampleRate: input.sampleRate,
        sourceLengthSamples: input.sourceLengthSamples,
        analysisMonoData: input.analysisMonoData,
      })
    : requested;
  const clamped = Math.max(0, Math.min(input.sourceLengthSamples, snapped));
  const errorCode = validateMarkerSample(
    input.markers,
    clamped,
    input.sourceLengthSamples,
    input.sampleRate,
  );
  const previousSlices = deriveSlices(input.markers, input.sourceLengthSamples, input.sampleRate);
  if (errorCode) {
    return {
      markers: input.markers,
      selectedMarkerId: null,
      selectedSliceId:
        findSliceBySample(previousSlices, requested)?.id ?? previousSlices[0]?.id ?? '',
      errorCode,
    };
  }

  const marker: SliceMarker = {
    id: createMarkerId(clamped, 'manual'),
    sampleIndex: clamped,
    origin: 'manual',
  };
  const markers = normalizeMarkers([...input.markers, marker], input.sourceLengthSamples);
  const slices = deriveSlices(markers, input.sourceLengthSamples, input.sampleRate);
  return {
    markers,
    selectedMarkerId: marker.id,
    selectedSliceId: findSliceAfterBoundary(slices, marker.id)?.id ?? slices[0]?.id ?? '',
  };
};

export const moveMarker = (input: {
  markers: SliceMarker[];
  markerId: string;
  requestedSample: number;
  sourceLengthSamples: number;
  sampleRate: number;
  analysisMonoData?: Float32Array;
  zeroCrossingEnabled: boolean;
}): SliceEditResult => {
  const marker = input.markers.find((candidate) => candidate.id === input.markerId);
  if (!marker) {
    const slices = deriveSlices(input.markers, input.sourceLengthSamples, input.sampleRate);
    return {
      markers: input.markers,
      selectedMarkerId: null,
      selectedSliceId: slices[0]?.id ?? '',
      errorCode: 'FIXED_BOUNDARY',
    };
  }

  const sorted = normalizeMarkers(input.markers, input.sourceLengthSamples);
  const markerIndex = sorted.findIndex((candidate) => candidate.id === input.markerId);
  const minSamples = minimumSliceSamples(input.sampleRate);
  const left = markerIndex > 0 ? sorted[markerIndex - 1].sampleIndex : 0;
  const right =
    markerIndex < sorted.length - 1
      ? sorted[markerIndex + 1].sampleIndex
      : input.sourceLengthSamples;
  const requested = Math.round(input.requestedSample);
  const clampedToNeighbors = Math.max(left + minSamples, Math.min(right - minSamples, requested));
  const snapped = input.zeroCrossingEnabled
    ? snapToZeroCrossing({
        requestedSample: clampedToNeighbors,
        sampleRate: input.sampleRate,
        sourceLengthSamples: input.sourceLengthSamples,
        analysisMonoData: input.analysisMonoData,
      })
    : clampedToNeighbors;
  const finalSample = Math.max(left + minSamples, Math.min(right - minSamples, snapped));

  const markers = normalizeMarkers(
    input.markers.map((candidate) =>
      candidate.id === input.markerId ? { ...candidate, sampleIndex: finalSample } : candidate,
    ),
    input.sourceLengthSamples,
  );
  const slices = deriveSlices(markers, input.sourceLengthSamples, input.sampleRate);
  return {
    markers,
    selectedMarkerId: marker.id,
    selectedSliceId:
      findSliceAfterBoundary(slices, marker.id)?.id ??
      findSliceBySample(slices, finalSample)?.id ??
      slices[0]?.id ??
      '',
  };
};

export const deleteMarker = (input: {
  markers: SliceMarker[];
  markerId: string | null;
  sourceLengthSamples: number;
  sampleRate: number;
}): SliceEditResult => {
  if (
    !input.markerId ||
    input.markerId === sourceStartBoundaryId ||
    input.markerId === sourceEndBoundaryId
  ) {
    const slices = deriveSlices(input.markers, input.sourceLengthSamples, input.sampleRate);
    return {
      markers: input.markers,
      selectedMarkerId: null,
      selectedSliceId: slices[0]?.id ?? '',
      errorCode: 'FIXED_BOUNDARY',
    };
  }

  const marker = input.markers.find((candidate) => candidate.id === input.markerId);
  if (!marker) {
    const slices = deriveSlices(input.markers, input.sourceLengthSamples, input.sampleRate);
    return {
      markers: input.markers,
      selectedMarkerId: null,
      selectedSliceId: slices[0]?.id ?? '',
      errorCode: 'FIXED_BOUNDARY',
    };
  }

  const markers = input.markers.filter((candidate) => candidate.id !== input.markerId);
  const slices = deriveSlices(markers, input.sourceLengthSamples, input.sampleRate);
  return {
    markers,
    selectedMarkerId: null,
    selectedSliceId: findSliceBySample(slices, marker.sampleIndex)?.id ?? slices[0]?.id ?? '',
  };
};

export const equalDivide = (input: {
  sliceCount: number;
  sourceLengthSamples: number;
  sampleRate: number;
}): SliceEditResult => {
  const sliceCount = Math.round(input.sliceCount);
  if (!Number.isInteger(input.sliceCount) || sliceCount < 2 || sliceCount > 128) {
    return {
      markers: [],
      selectedMarkerId: null,
      selectedSliceId: '',
      errorCode: 'DIVISION_INVALID',
    };
  }
  if (sliceCount - 1 > MAX_SLICE_MARKERS) {
    return { markers: [], selectedMarkerId: null, selectedSliceId: '', errorCode: 'MARKER_LIMIT' };
  }
  const minSamples = minimumSliceSamples(input.sampleRate);
  if (input.sourceLengthSamples / sliceCount < minSamples) {
    return {
      markers: [],
      selectedMarkerId: null,
      selectedSliceId: '',
      errorCode: 'DIVISION_TOO_DENSE',
    };
  }

  const markers: SliceMarker[] = [];
  for (let index = 1; index < sliceCount; index += 1) {
    const sampleIndex = Math.round((input.sourceLengthSamples * index) / sliceCount);
    markers.push({
      id: `equal-${sliceCount}-${index}`,
      sampleIndex,
      origin: 'equal-division',
    });
  }
  const slices = deriveSlices(markers, input.sourceLengthSamples, input.sampleRate);
  return {
    markers,
    selectedMarkerId: null,
    selectedSliceId: slices[0]?.id ?? '',
  };
};

export const resetMarkers = (sourceLengthSamples: number, sampleRate: number): SliceEditResult => {
  const slices = deriveSlices([], sourceLengthSamples, sampleRate);
  return {
    markers: [],
    selectedMarkerId: null,
    selectedSliceId: slices[0]?.id ?? '',
  };
};
