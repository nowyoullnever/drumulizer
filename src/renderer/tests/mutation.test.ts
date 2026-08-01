import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent, setEventLock } from '../sequencer/patternModel';
import {
  generatedFixtureAnalysis,
  generatedFixtureSlices,
} from '../sequencer/generator/evaluation/fixtures';
import {
  createDefaultGeneratorSettings,
  createDefaultMutationState,
} from '../sequencer/generator/generatorTypes';
import { generatePattern } from '../sequencer/generator/generatePattern';
import { mutatePattern } from '../sequencer/generator/mutatePattern';

const sliceInput = {
  slices: generatedFixtureSlices(),
  analyses: generatedFixtureAnalysis().analyses,
  annotations: { overrides: {}, excluded: {} },
};

describe('generator mutation', () => {
  it('increments mutation index deterministically and marks changed events', () => {
    const generated = generatePattern({
      pattern: createDefaultPattern(),
      selectedEventId: null,
      sliceInput,
      settings: createDefaultGeneratorSettings(),
      action: 'generate',
    });
    const first = mutatePattern({
      pattern: generated.pattern,
      selectedEventId: generated.selectedEventId,
      sliceInput,
      settings: createDefaultGeneratorSettings(),
      mutationState: createDefaultMutationState(),
    });
    const second = mutatePattern({
      pattern: generated.pattern,
      selectedEventId: generated.selectedEventId,
      sliceInput,
      settings: createDefaultGeneratorSettings(),
      mutationState: createDefaultMutationState(),
    });
    expect(first.mutationState.mutationIndex).toBe(1);
    expect(first.pattern.events).toEqual(second.pattern.events);
    expect(first.pattern.events.some((event) => event.origin === 'mutated')).toBe(true);
  });

  it('preserves locked events during mutation', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'mid', stepIndex: 4, sliceId: 'slice-3' }).pattern;
    pattern = setEventLock(pattern, pattern.events[0].id, true).pattern;
    const result = mutatePattern({
      pattern,
      selectedEventId: pattern.events[0].id,
      sliceInput,
      settings: createDefaultGeneratorSettings(),
      mutationState: createDefaultMutationState(),
    });
    expect(result.pattern.events.find((event) => event.id === pattern.events[0].id)).toMatchObject({
      locked: true,
      origin: 'manual',
    });
  });
});
