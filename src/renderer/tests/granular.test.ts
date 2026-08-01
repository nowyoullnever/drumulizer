import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent, updateEvent } from '../sequencer/patternModel';
import { scheduleWindow } from '../sequencer/schedulerMath';
import type { SliceRegion } from '../slice/types';

const slices: SliceRegion[] = [
  {
    id: 'slice-a',
    index: 0,
    startSample: 0,
    endSample: 48000,
    durationSamples: 48000,
    startSeconds: 0,
    endSeconds: 1,
    durationSeconds: 1,
    leftBoundaryId: 'source-start',
    rightBoundaryId: 'source-end',
  },
];

describe('granular event planning', () => {
  it('plans bounded deterministic grains inside slice offsets', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'texture', stepIndex: 0, sliceId: 'slice-a' }).pattern;
    pattern = updateEvent(pattern, pattern.events[0].id, {
      transform: {
        ...pattern.events[0].transform,
        playbackMode: 'granular',
        grainCount: 5,
        grainSizeMs: 30,
        grainPosition: 0.5,
        grainSpray: 0.4,
        grainPitchJitterSemitones: 6,
      },
    }).pattern;
    const first = scheduleWindow({
      pattern,
      slices,
      windowStartSeconds: 0,
      windowEndSeconds: 1,
      transportOriginSeconds: 0,
      scheduledKeys: new Set<string>(),
      masterGain: 1,
      seed: 'same',
      maxVoices: 32,
    });
    const second = scheduleWindow({
      pattern,
      slices,
      windowStartSeconds: 0,
      windowEndSeconds: 1,
      transportOriginSeconds: 0,
      scheduledKeys: new Set<string>(),
      masterGain: 1,
      seed: 'same',
      maxVoices: 32,
    });
    expect(first.scheduled).toHaveLength(5);
    expect(first.scheduled).toEqual(second.scheduled);
    expect(
      first.scheduled.every((voice) => voice.offsetSeconds >= 0 && voice.offsetSeconds < 1),
    ).toBe(true);
    expect(first.scheduled.every((voice) => voice.playbackMode === 'granular')).toBe(true);
  });
});
