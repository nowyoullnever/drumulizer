import { describe, expect, it } from 'vitest';
import { createDefaultPattern } from '../sequencer/patternModel';
import { createPrng } from '../sequencer/generator/prng';
import { classifyStep, plannedStepsForLane } from '../sequencer/generator/rhythmGrammar';

describe('generator grammar', () => {
  it('classifies metrical positions and keeps LOW anchors', () => {
    expect(classifyStep(0)).toBe('downbeat');
    expect(classifyStep(4)).toBe('quarter');
    expect(classifyStep(2)).toBe('eighthOffbeat');
    const pattern = createDefaultPattern();
    const steps = plannedStepsForLane(pattern, 'low', 40, 20, 0, createPrng('grammar-low'));
    expect(steps).toContain(0);
    expect(steps).toContain(16);
  });

  it('generally increases HIGH event count with density', () => {
    const pattern = createDefaultPattern();
    const low = plannedStepsForLane(pattern, 'high', 10, 30, 20, createPrng('density'));
    const high = plannedStepsForLane(pattern, 'high', 90, 30, 20, createPrng('density'));
    expect(high.length).toBeGreaterThanOrEqual(low.length);
  });
});
