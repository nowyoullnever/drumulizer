import { describe, expect, it } from 'vitest';
import { detectOnsets } from '../audio/onset/detectOnsets';
import { evaluateCandidates } from '../audio/onset/evaluation/evaluateCandidates';
import { generateOnsetEvaluationFixtures } from '../audio/onset/evaluation/generatedFixtures';

describe('onset evaluation corpus', () => {
  it('meets deterministic quality targets across generated fixtures', () => {
    const fixtures = generateOnsetEvaluationFixtures();
    const results = fixtures.map((fixture) => {
      const result = detectOnsets({
        requestId: fixture.name,
        monoData: fixture.samples,
        originalSampleRate: fixture.sampleRate,
        settings: { sensitivity: 55, minimumGapMs: 45 },
      });
      return {
        fixture,
        result,
        metrics: evaluateCandidates(
          result.candidates,
          fixture.expectedSeconds,
          fixture.samples.length / fixture.sampleRate,
        ),
      };
    });

    expect(fixtures.map((fixture) => fixture.name)).toHaveLength(19);
    for (const { fixture, result, metrics } of results) {
      expect(result.candidates.every((candidate) => Number.isFinite(candidate.confidence))).toBe(
        true,
      );
      expect(
        result.candidates.every(
          (candidate) => candidate.confidence >= 0 && candidate.confidence <= 1,
        ),
      ).toBe(true);
      if (fixture.maxCandidates !== undefined) {
        expect(result.candidates.length, fixture.name).toBeLessThanOrEqual(fixture.maxCandidates);
      }
      if (fixture.expectedSeconds.length > 0) {
        expect(metrics.meanAbsoluteTimingErrorMs, fixture.name).toBeLessThan(25);
      }
    }

    const byName = new Map(results.map((result) => [result.fixture.name, result]));
    expect(byName.get('isolated impulse')?.metrics.recall).toBe(1);
    expect(byName.get('repeated impulse train')?.metrics.f1).toBeGreaterThanOrEqual(0.95);
    expect(byName.get('kick-like decaying sine bursts')?.metrics.recall).toBeGreaterThanOrEqual(
      0.85,
    );
    expect(byName.get('high-frequency clicks')?.metrics.recall).toBeGreaterThanOrEqual(0.9);
    expect(byName.get('alternating low and high attacks')?.metrics.f1).toBeGreaterThanOrEqual(0.85);
    expect(byName.get('silence')?.result.candidates).toHaveLength(0);
  });

  it('keeps gain-scaled candidate timing stable', () => {
    const fixtures = generateOnsetEvaluationFixtures().filter((fixture) =>
      fixture.name.startsWith('gain pattern'),
    );
    const candidateSets = fixtures.map((fixture) =>
      detectOnsets({
        requestId: fixture.name,
        monoData: fixture.samples,
        originalSampleRate: fixture.sampleRate,
        settings: { sensitivity: 55, minimumGapMs: 45 },
      }).candidates.map((candidate) => candidate.timeSeconds),
    );
    expect(new Set(candidateSets.map((set) => set.length)).size).toBe(1);
    for (let index = 0; index < candidateSets[0].length; index += 1) {
      const times = candidateSets.map((set) => set[index]);
      expect(Math.max(...times) - Math.min(...times)).toBeLessThan(0.025);
    }
  });
});
