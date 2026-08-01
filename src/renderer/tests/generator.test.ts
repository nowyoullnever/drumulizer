import { describe, expect, it } from 'vitest';
import {
  createDefaultPattern,
  paintEvent,
  setEventLock,
  setLaneState,
} from '../sequencer/patternModel';
import {
  generatedFixtureAnalysis,
  generatedFixtureSlices,
} from '../sequencer/generator/evaluation/fixtures';
import { generatePattern } from '../sequencer/generator/generatePattern';
import { createDefaultGeneratorSettings } from '../sequencer/generator/generatorTypes';

const sliceInput = () => ({
  slices: generatedFixtureSlices(),
  analyses: generatedFixtureAnalysis().analyses,
  annotations: { overrides: {}, excluded: { 'slice-10': true } },
});

describe('deterministic pattern generator', () => {
  it('reproduces placement, ids, slices, and parameters from the same seed', () => {
    const pattern = createDefaultPattern();
    const settings = createDefaultGeneratorSettings();
    const first = generatePattern({
      pattern,
      selectedEventId: null,
      sliceInput: sliceInput(),
      settings,
      action: 'generate',
    });
    const second = generatePattern({
      pattern,
      selectedEventId: null,
      sliceInput: sliceInput(),
      settings,
      action: 'generate',
    });
    expect(first.pattern.events).toEqual(second.pattern.events);
    expect(first.pattern.events.length).toBeGreaterThan(0);
    expect(
      new Set(first.pattern.events.map((event) => `${event.laneId}:${event.stepIndex}`)).size,
    ).toBe(first.pattern.events.length);
    expect(first.pattern.events.every((event) => event.origin === 'generated')).toBe(true);
    expect(first.pattern.events.every((event) => event.sliceId !== 'slice-10')).toBe(true);
  });

  it('preserves manual events and locked lanes in preserve-manual mode', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'low', stepIndex: 0, sliceId: 'slice-1' }).pattern;
    pattern = setLaneState(pattern, 'high', { generationLocked: true });
    const result = generatePattern({
      pattern,
      selectedEventId: pattern.events[0].id,
      sliceInput: sliceInput(),
      settings: createDefaultGeneratorSettings(),
      action: 'generate',
    });
    expect(result.pattern.events.find((event) => event.id === pattern.events[0].id)?.origin).toBe(
      'manual',
    );
    expect(
      result.pattern.events.some(
        (event) => event.laneId === 'high' && event.origin === 'generated',
      ),
    ).toBe(false);
  });

  it('allows replace-unlocked to replace unlocked manual events but keep locked events', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'low', stepIndex: 0, sliceId: 'slice-1' }).pattern;
    pattern = paintEvent({ pattern, laneId: 'mid', stepIndex: 4, sliceId: 'slice-3' }).pattern;
    pattern = setEventLock(pattern, pattern.events[1].id, true).pattern;
    const result = generatePattern({
      pattern,
      selectedEventId: null,
      sliceInput: sliceInput(),
      settings: { ...createDefaultGeneratorSettings(), mode: 'replace-unlocked' },
      action: 'regenerate',
    });
    expect(result.pattern.events.some((event) => event.id === pattern.events[0].id)).toBe(false);
    expect(
      result.pattern.events.some((event) => event.id === pattern.events[1].id && event.locked),
    ).toBe(true);
  });
});
