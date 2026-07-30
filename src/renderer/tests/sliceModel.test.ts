import { describe, expect, it } from 'vitest';
import { MAX_HISTORY_ENTRIES } from '../../shared/constants/slice';
import { computeAuditionRegion, computeCandidateAuditionRegion } from '../audio/auditionMath';
import {
  addMarker,
  deleteMarker,
  deriveBoundaries,
  deriveSlices,
  equalDivide,
  moveMarker,
  resetMarkers,
  sourceEndBoundaryId,
  sourceStartBoundaryId,
} from '../slice/sliceModel';
import {
  createSliceHistory,
  pushSliceHistory,
  redoSliceHistory,
  undoSliceHistory,
} from '../slice/history';
import { snapToZeroCrossing } from '../slice/zeroCrossing';
import type { SliceHistoryState, SliceMarker } from '../slice/types';

const sampleRate = 1000;
const sourceLengthSamples = 1000;

const marker = (sampleIndex: number, id = `m-${sampleIndex}`): SliceMarker => ({
  id,
  sampleIndex,
  origin: 'manual',
});

describe('slice derivation', () => {
  it('derives full-file and multi-marker slices without gaps or overlaps', () => {
    expect(deriveSlices([], sourceLengthSamples, sampleRate)).toMatchObject([
      { index: 0, startSample: 0, endSample: 1000, durationSamples: 1000 },
    ]);

    const slices = deriveSlices(
      [marker(250), marker(750), marker(500)],
      sourceLengthSamples,
      sampleRate,
    );
    expect(slices.map((slice) => [slice.startSample, slice.endSample])).toEqual([
      [0, 250],
      [250, 500],
      [500, 750],
      [750, 1000],
    ]);
    expect(slices.every((slice) => Number.isFinite(slice.durationSeconds))).toBe(true);
    expect(slices.at(0)?.leftBoundaryId).toBe(sourceStartBoundaryId);
    expect(slices.at(-1)?.rightBoundaryId).toBe(sourceEndBoundaryId);
  });

  it('includes fixed source boundaries', () => {
    const boundaries = deriveBoundaries([marker(500)], sourceLengthSamples);
    expect(boundaries[0]).toEqual({ id: sourceStartBoundaryId, sampleIndex: 0, fixed: true });
    expect(boundaries.at(-1)).toEqual({
      id: sourceEndBoundaryId,
      sampleIndex: sourceLengthSamples,
      fixed: true,
    });
  });
});

describe('marker operations', () => {
  it('adds, sorts, rejects close markers, clamps movement, and deletes markers', () => {
    const added = addMarker({
      markers: [marker(600)],
      requestedSample: 300,
      sourceLengthSamples,
      sampleRate,
      zeroCrossingEnabled: false,
    });
    expect(added.markers.map((candidate) => candidate.sampleIndex)).toEqual([300, 600]);

    const duplicate = addMarker({
      markers: added.markers,
      requestedSample: 302,
      sourceLengthSamples,
      sampleRate,
      zeroCrossingEnabled: false,
    });
    expect(duplicate.errorCode).toBe('MARKER_TOO_CLOSE');

    const moved = moveMarker({
      markers: added.markers,
      markerId: added.markers[0].id,
      requestedSample: 599,
      sourceLengthSamples,
      sampleRate,
      zeroCrossingEnabled: false,
    });
    expect(moved.markers[0].sampleIndex).toBeLessThanOrEqual(595);

    const deleted = deleteMarker({
      markers: moved.markers,
      markerId: moved.markers[0].id,
      sourceLengthSamples,
      sampleRate,
    });
    expect(deleted.markers).toHaveLength(1);

    expect(
      deleteMarker({
        markers: deleted.markers,
        markerId: sourceStartBoundaryId,
        sourceLengthSamples,
        sampleRate,
      }).errorCode,
    ).toBe('FIXED_BOUNDARY');
  });

  it('enforces the marker limit', () => {
    const markers = Array.from({ length: 512 }, (_, index) =>
      marker((index + 1) * 10, `m${index}`),
    );
    expect(
      addMarker({
        markers,
        requestedSample: 999,
        sourceLengthSamples: 6000,
        sampleRate,
        zeroCrossingEnabled: false,
      }).errorCode,
    ).toBe('MARKER_LIMIT');
  });
});

describe('equal division', () => {
  it('creates 4, 8, 16, 32, and custom divisions with exact source coverage', () => {
    [4, 8, 16, 32, 7].forEach((count) => {
      const result = equalDivide({ sliceCount: count, sourceLengthSamples: 32000, sampleRate });
      expect(result.errorCode).toBeUndefined();
      expect(result.markers).toHaveLength(count - 1);
      expect(result.markers.every((candidate) => candidate.origin === 'equal-division')).toBe(true);
      const slices = deriveSlices(result.markers, 32000, sampleRate);
      expect(slices).toHaveLength(count);
      expect(slices[0].startSample).toBe(0);
      expect(slices.at(-1)?.endSample).toBe(32000);
    });
  });

  it('rejects invalid and too-dense divisions without zero-crossing shifts', () => {
    expect(equalDivide({ sliceCount: 1, sourceLengthSamples, sampleRate }).errorCode).toBe(
      'DIVISION_INVALID',
    );
    expect(equalDivide({ sliceCount: 128, sourceLengthSamples: 100, sampleRate }).errorCode).toBe(
      'DIVISION_TOO_DENSE',
    );
    expect(
      equalDivide({ sliceCount: 4, sourceLengthSamples: 1000, sampleRate }).markers[0].sampleIndex,
    ).toBe(250);
  });
});

describe('zero crossing', () => {
  it('snaps to the nearest sign change inside the search window', () => {
    const data = new Float32Array(100).fill(0.5);
    data[49] = 0.4;
    data[50] = -0.1;
    data[51] = -0.3;
    expect(
      snapToZeroCrossing({
        requestedSample: 52,
        sampleRate: 1000,
        sourceLengthSamples: 100,
        analysisMonoData: data,
      }),
    ).toBe(52);
  });

  it('uses low-amplitude fallback and disabled mode preserves requested sample', () => {
    const data = new Float32Array(100).fill(0.6);
    data[43] = 0.01;
    expect(
      snapToZeroCrossing({
        requestedSample: 45,
        sampleRate: 1000,
        sourceLengthSamples: 100,
        analysisMonoData: data,
      }),
    ).toBe(43);
    expect(
      addMarker({
        markers: [],
        requestedSample: 45,
        sourceLengthSamples: 100,
        sampleRate: 1000,
        analysisMonoData: data,
        zeroCrossingEnabled: false,
      }).markers[0].sampleIndex,
    ).toBe(45);
  });
});

describe('slice history', () => {
  const emptyState: SliceHistoryState = {
    markers: [],
    selectedMarkerId: null,
    selectedSliceId: 'full',
  };

  it('supports undo, redo, redo clearing, and history limit', () => {
    const first = { markers: [marker(100)], selectedMarkerId: 'm-100', selectedSliceId: 'a' };
    const second = { markers: [marker(200)], selectedMarkerId: 'm-200', selectedSliceId: 'b' };
    let history = createSliceHistory(emptyState);
    history = pushSliceHistory(history, first);
    history = pushSliceHistory(history, second);
    expect(undoSliceHistory(history).present).toEqual(first);
    expect(redoSliceHistory(undoSliceHistory(history)).present).toEqual(second);

    history = undoSliceHistory(history);
    history = pushSliceHistory(history, second);
    expect(history.future).toHaveLength(0);

    for (let index = 0; index < MAX_HISTORY_ENTRIES + 10; index += 1) {
      history = pushSliceHistory(history, {
        markers: [marker(index + 10)],
        selectedMarkerId: null,
        selectedSliceId: String(index),
      });
    }
    expect(history.past.length).toBe(MAX_HISTORY_ENTRIES);
  });

  it('resets markers to one full-file slice state', () => {
    const reset = resetMarkers(sourceLengthSamples, sampleRate);
    expect(reset.markers).toHaveLength(0);
    expect(deriveSlices(reset.markers, sourceLengthSamples, sampleRate)).toHaveLength(1);
    expect(reset.selectedMarkerId).toBeNull();
  });
});

describe('slice audition math', () => {
  it('computes region start, fade clamping, and pre-roll clamping', () => {
    expect(computeAuditionRegion({ startSeconds: 1, endSeconds: 2, prerollMs: 20 })).toMatchObject({
      offsetSeconds: 0.98,
      durationSeconds: 1.02,
      fadeSeconds: 0.003,
      prerollSeconds: 0.02,
    });
    const shortRegion = computeAuditionRegion({
      startSeconds: 0.005,
      endSeconds: 0.009,
      prerollMs: 50,
    });
    expect(shortRegion.offsetSeconds).toBe(0);
    expect(shortRegion.durationSeconds).toBe(0.009);
    expect(shortRegion.fadeSeconds).toBeCloseTo(0.001);
    expect(shortRegion.prerollSeconds).toBe(0.005);
  });

  it('computes candidate audition windows with pre-roll and start clamping', () => {
    const centered = computeCandidateAuditionRegion({
      sampleIndex: 500,
      sampleRate: 1000,
      preMs: 20,
      postMs: 120,
    });
    expect(centered.offsetSeconds).toBeCloseTo(0.48);
    expect(centered.durationSeconds).toBeCloseTo(0.14);
    expect(centered.prerollSeconds).toBeCloseTo(0.02);

    const nearStart = computeCandidateAuditionRegion({
      sampleIndex: 5,
      sampleRate: 1000,
      preMs: 20,
      postMs: 120,
    });
    expect(nearStart.offsetSeconds).toBe(0);
    expect(nearStart.durationSeconds).toBe(0.125);
    expect(nearStart.prerollSeconds).toBe(0.005);

    const nearEnd = computeCandidateAuditionRegion({
      sampleIndex: 990,
      sampleRate: 1000,
      sourceDurationSeconds: 1,
      preMs: 20,
      postMs: 120,
    });
    expect(nearEnd.offsetSeconds).toBeCloseTo(0.97);
    expect(nearEnd.durationSeconds).toBeCloseTo(0.03);
    expect(nearEnd.fadeSeconds).toBeLessThanOrEqual(nearEnd.durationSeconds * 0.25);
  });
});
