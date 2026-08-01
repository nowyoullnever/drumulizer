import type { SliceAnalysisLifecycle } from '../../audio/sliceAnalysis/sliceAnalysisTypes';
import type { SliceRegion } from '../../slice/types';
import type { SequencerPattern, SequencerTransportState } from '../types';
import type { GeneratorSliceInput } from './generatorTypes';
import { createSliceCandidatePools } from './slicePools';

export interface GeneratorPrerequisites {
  ready: boolean;
  reasonKey: string | null;
}

export const generatorPrerequisites = (input: {
  hasSource: boolean;
  slices: SliceRegion[];
  lifecycle: SliceAnalysisLifecycle;
  transport: SequencerTransportState;
  sliceInput: GeneratorSliceInput;
}): GeneratorPrerequisites => {
  if (!input.hasSource) return { ready: false, reasonKey: 'generator.reason.noSource' };
  if (input.slices.length === 0) return { ready: false, reasonKey: 'generator.reason.noSlices' };
  if (input.lifecycle !== 'ready')
    return { ready: false, reasonKey: 'generator.reason.analysisNotReady' };
  if (input.transport.status !== 'stopped')
    return { ready: false, reasonKey: 'generator.reason.transportLocked' };
  const pools = createSliceCandidatePools(input.sliceInput);
  if (Object.values(pools).every((pool) => pool.length === 0)) {
    return { ready: false, reasonKey: 'generator.reason.noEligibleSlices' };
  }
  return { ready: true, reasonKey: null };
};

export const patternHash = (pattern: SequencerPattern): string =>
  JSON.stringify(
    pattern.events.map((event) => [
      event.id,
      event.laneId,
      event.stepIndex,
      event.sliceId,
      event.velocity.toFixed(3),
      event.pan.toFixed(3),
      event.pitchSemitones,
      event.origin,
      event.locked,
    ]),
  );
