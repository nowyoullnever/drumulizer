import { describe, expect, it } from 'vitest';
import { analyzeSlices, sliceSetSignature } from '../audio/sliceAnalysis/analyzeSlices';
import { generateSliceAnalysisFixtures } from '../audio/sliceAnalysis/evaluation/generatedFixtures';
import { calculateEffectiveRole } from '../audio/sliceAnalysis/roleScoring';

describe('slice analysis and role scoring', () => {
  it('evaluates a deterministic corpus with at least 18 categories', () => {
    const fixtures = generateSliceAnalysisFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(18);

    const totalSamples = fixtures.reduce((sum, fixture) => sum + fixture.samples.length, 0);
    const monoData = new Float32Array(totalSamples);
    let cursor = 0;
    const slices = fixtures.map((fixture, index) => {
      monoData.set(fixture.samples, cursor);
      const startSample = cursor;
      cursor += fixture.samples.length;
      return {
        ...fixture.slices[0],
        id: `fixture-${index}`,
        index,
        startSample,
        endSample: cursor,
        leftBoundaryId: index === 0 ? 'source-start' : `fixture-boundary-${index}`,
        rightBoundaryId:
          index === fixtures.length - 1 ? 'source-end' : `fixture-boundary-${index + 1}`,
      };
    });

    const results = analyzeSlices({
      requestId: 'corpus',
      sourceId: 'corpus',
      sliceSetSignature: sliceSetSignature('corpus', slices),
      monoData,
      originalSampleRate: fixtures[0].sampleRate,
      slices,
    }).analyses;

    for (const result of results) {
      expect(result.features.durationMs).toBeGreaterThan(0);
      expect(Object.values(result.laneScores).every((score) => score >= 0 && score <= 1)).toBe(
        true,
      );
      expect(Object.values(result.microScores).every((score) => score >= 0 && score <= 1)).toBe(
        true,
      );
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }

    const byName = new Map(results.map((result, index) => [fixtures[index].name, result]));
    expect(byName.get('sub drop')?.automaticRole).toBe('low');
    expect(byName.get('round low body')?.automaticRole).toBe('low');
    expect(byName.get('bright click')?.automaticRole).toBe('high');
    expect(byName.get('quiet high click')?.automaticRole).not.toBe('low');
    expect(byName.get('nearly silent')?.automaticRole).toBe('unclassified');
    expect(new Set(results.map((result) => result.automaticRole)).size).toBeGreaterThanOrEqual(4);
  });

  it('keeps lane scores independent and applies override/exclusion semantics', () => {
    const [fixture] = generateSliceAnalysisFixtures();
    const analysis = analyzeSlices({
      requestId: 'roles',
      sourceId: 'source',
      sliceSetSignature: sliceSetSignature('source', fixture.slices),
      monoData: fixture.samples,
      originalSampleRate: fixture.sampleRate,
      slices: fixture.slices,
    }).analyses[0];

    const sum = Object.values(analysis.laneScores).reduce((acc, score) => acc + score, 0);
    expect(sum).not.toBeCloseTo(1, 3);
    expect(calculateEffectiveRole(analysis, 'high', false)).toBe('high');
    expect(calculateEffectiveRole(analysis, 'auto', false)).toBe(analysis.automaticRole);
    expect(calculateEffectiveRole(analysis, 'low', true)).toBe('unclassified');
  });
});
