import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent, updateEvent } from '../sequencer/patternModel';
import { probabilityAllowsEvent } from '../sequencer/schedulerMath';

const eventWithProbability = (probability: number) => {
  const pattern = paintEvent({
    pattern: createDefaultPattern(),
    laneId: 'low',
    stepIndex: 0,
    sliceId: 'slice-a',
  }).pattern;
  return updateEvent(pattern, pattern.events[0].id, {
    transform: { ...pattern.events[0].transform, probability },
  }).pattern.events[0];
};

describe('event probability', () => {
  it('handles deterministic extremes and loop-keyed decisions', () => {
    expect(
      probabilityAllowsEvent({ seed: 'a', event: eventWithProbability(1), loopIndex: 0 }),
    ).toBe(true);
    expect(
      probabilityAllowsEvent({ seed: 'a', event: eventWithProbability(0), loopIndex: 0 }),
    ).toBe(false);
    const event = eventWithProbability(0.5);
    const first = probabilityAllowsEvent({ seed: 'seed-a', event, loopIndex: 4 });
    expect(probabilityAllowsEvent({ seed: 'seed-a', event, loopIndex: 4 })).toBe(first);
    const sequenceA = Array.from({ length: 8 }, (_, loopIndex) =>
      probabilityAllowsEvent({ seed: 'seed-a', event, loopIndex }),
    );
    const sequenceB = Array.from({ length: 8 }, (_, loopIndex) =>
      probabilityAllowsEvent({ seed: 'seed-b', event, loopIndex }),
    );
    expect(sequenceA).not.toEqual(sequenceB);
  });
});
