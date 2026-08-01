import { describe, expect, it } from 'vitest';
import { createDefaultPattern } from '../sequencer/patternModel';
import {
  generatedFixtureAnalysis,
  generatedFixtureSlices,
} from '../sequencer/generator/evaluation/fixtures';
import { createDefaultGeneratorSettings } from '../sequencer/generator/generatorTypes';
import { generatePattern } from '../sequencer/generator/generatePattern';
import { patternHash } from '../sequencer/generator/generationDiagnostics';

const sliceInput = {
  slices: generatedFixtureSlices(),
  analyses: generatedFixtureAnalysis().analyses,
  annotations: { overrides: {}, excluded: { 'slice-10': true } },
};

describe('generator evaluation', () => {
  it('reports deterministic hashes and avoids invalid fixture slices', () => {
    const settings = { ...createDefaultGeneratorSettings(), seed: 'eval-seed' };
    const first = generatePattern({
      pattern: createDefaultPattern(),
      selectedEventId: null,
      sliceInput,
      settings,
      action: 'generate',
    });
    const second = generatePattern({
      pattern: createDefaultPattern(),
      selectedEventId: null,
      sliceInput,
      settings,
      action: 'generate',
    });
    expect(patternHash(first.pattern)).toBe(patternHash(second.pattern));
    expect(first.pattern.events.every((event) => event.sliceId !== 'slice-10')).toBe(true);
    expect(
      new Set(first.pattern.events.map((event) => `${event.laneId}:${event.stepIndex}`)).size,
    ).toBe(first.pattern.events.length);
  });

  it('generally keeps density relationship monotonic for generated events', () => {
    const counts = [0, 25, 50, 75, 100].map(
      (density) =>
        generatePattern({
          pattern: createDefaultPattern(),
          selectedEventId: null,
          sliceInput,
          settings: { ...createDefaultGeneratorSettings(), density, seed: 'density-eval' },
          action: 'generate',
        }).pattern.events.length,
    );
    expect(counts.at(-1)).toBeGreaterThanOrEqual(counts[0]);
  });
});
