import { SEQUENCER_STEPS_PER_BAR } from '../../../shared/constants/sequencer';
import type { SequencerLaneId, SequencerPattern } from '../types';
import type { DeterministicPrng } from './prng';

export type MetricalClass = 'downbeat' | 'quarter' | 'eighthOffbeat' | 'secondary' | 'sixteenth';

export const classifyStep = (stepInBar: number): MetricalClass => {
  if (stepInBar === 0) return 'downbeat';
  if (stepInBar % 4 === 0) return 'quarter';
  if (stepInBar % 4 === 2) return 'eighthOffbeat';
  if (stepInBar % 2 === 0) return 'secondary';
  return 'sixteenth';
};

export const metricalWeight = (laneId: SequencerLaneId, stepInBar: number): number => {
  const metricalClass = classifyStep(stepInBar);
  const base = {
    downbeat: 1,
    quarter: 0.82,
    eighthOffbeat: 0.58,
    secondary: 0.36,
    sixteenth: 0.22,
  } satisfies Record<MetricalClass, number>;
  if (laneId === 'mid' && (stepInBar === 4 || stepInBar === 12)) return 1;
  if (laneId === 'high' && stepInBar % 2 === 0) return Math.max(base[metricalClass], 0.72);
  if (laneId === 'texture') return stepInBar === 15 ? 0.88 : base[metricalClass] * 0.72;
  return base[metricalClass];
};

const laneMotifs: Record<SequencerLaneId, number[]> = {
  low: [0, 8],
  mid: [4, 12],
  high: [0, 4, 8, 12],
  texture: [15],
};

const laneExtras: Record<SequencerLaneId, number[]> = {
  low: [3, 6, 10, 14, 12, 4],
  mid: [3, 5, 11, 13, 8, 14],
  high: [2, 6, 10, 14, 1, 5, 9, 13, 3, 7, 11, 15],
  texture: [7, 11, 14, 3, 10],
};

const targetPerBar = (laneId: SequencerLaneId, density: number): number => {
  const amount = density / 100;
  if (laneId === 'low') return 1 + Math.round(amount * 4);
  if (laneId === 'mid') return 1 + Math.round(amount * 5);
  if (laneId === 'high') return 2 + Math.round(amount * 10);
  return amount < 0.2 ? 0 : 1 + Math.round(amount * 3);
};

const displaceStep = (step: number, breakage: number, prng: DeterministicPrng): number => {
  if (breakage <= 0 || !prng.chance(breakage / 240)) return step;
  const delta = prng.chance(0.5) ? -1 : 1;
  return Math.max(0, Math.min(SEQUENCER_STEPS_PER_BAR - 1, step + delta));
};

const shuffleDeterministically = <T>(values: T[], prng: DeterministicPrng): T[] => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(prng.next() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

export const plannedStepsForLane = (
  pattern: SequencerPattern,
  laneId: SequencerLaneId,
  density: number,
  variation: number,
  breakage: number,
  prng: DeterministicPrng,
): number[] => {
  const steps: number[] = [];
  const baseMotif = laneMotifs[laneId];
  const extras = laneExtras[laneId];
  for (let bar = 0; bar < pattern.bars; bar += 1) {
    const finalBar = bar === pattern.bars - 1 && pattern.bars > 1;
    const barSteps = new Set<number>();
    for (const motifStep of baseMotif) {
      const omitAnchor = breakage > 0 && motifStep !== 0 && prng.chance((breakage / 100) * 0.22);
      if (!omitAnchor || (laneId === 'low' && motifStep === 0)) {
        barSteps.add(displaceStep(motifStep, finalBar ? breakage * 1.2 : breakage, prng));
      }
    }
    const desired = targetPerBar(laneId, density) + (finalBar && density > 35 ? 1 : 0);
    const shuffledExtras = shuffleDeterministically(extras, prng);
    for (const extra of shuffledExtras) {
      if (barSteps.size >= desired) break;
      const addChance = density / 105 + variation / 280 + (finalBar ? breakage / 260 : 0);
      if (barSteps.size < Math.max(1, desired - 1) || prng.chance(addChance)) {
        barSteps.add(displaceStep(extra, breakage, prng));
      }
    }
    if (variation < 12 && bar > 0 && !finalBar) {
      for (const motifStep of baseMotif) barSteps.add(motifStep);
    }
    for (const stepInBar of [...barSteps].sort((left, right) => left - right)) {
      steps.push(bar * SEQUENCER_STEPS_PER_BAR + stepInBar);
    }
  }
  return [...new Set(steps)].filter(
    (step) => step >= 0 && step < pattern.bars * SEQUENCER_STEPS_PER_BAR,
  );
};
