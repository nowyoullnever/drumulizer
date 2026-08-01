import type { AudioSourceMetadata } from '../audio/types';
import type { OnsetApplyMode } from '../audio/onset/onsetTypes';
import type {
  SliceAnalysisResult,
  SliceAnnotationState,
} from '../audio/sliceAnalysis/sliceAnalysisTypes';
import type { SliceHistoryState } from '../slice/types';
import type {
  IDMTransformMutationState,
  IDMTransformSettings,
  PatternGeneratorSettings,
  PatternMutationState,
  SequencerPattern,
} from '../sequencer/types';

export interface SerializableCreativeProjectState {
  source: {
    token: string;
    decoded: {
      sampleRate: number;
      numberOfChannels: number;
      lengthSamples: number;
      durationSeconds: number;
    };
  };
  editor: {
    markers: SliceHistoryState['markers'];
    zeroCrossingEnabled: boolean;
    customDivision: number;
    onsetSettings: {
      sensitivity: number;
      minimumGapMs: number;
    };
    onsetApplyMode: OnsetApplyMode;
  };
  sliceAnalysis: {
    result: SliceAnalysisResult;
    annotations: SliceAnnotationState;
  } | null;
  sequencer: {
    pattern: SequencerPattern;
    generatorSettings: PatternGeneratorSettings;
    mutationState: PatternMutationState;
    idmSettings: IDMTransformSettings;
    idmMutationState: IDMTransformMutationState;
    masterGain: number;
  };
}

export interface ProjectSnapshotInput {
  sourceToken: string | null;
  metadata: AudioSourceMetadata | null;
  sourceLengthSamples: number;
  sliceHistory: SliceHistoryState;
  zeroCrossingEnabled: boolean;
  customDivision: number;
  onsetSettings: {
    sensitivity: number;
    minimumGapMs: number;
  };
  onsetApplyMode: OnsetApplyMode;
  validSliceAnalysis: SliceAnalysisResult | null;
  sliceAnnotations: SliceAnnotationState;
  pattern: SequencerPattern;
  generatorSettings: PatternGeneratorSettings;
  mutationState: PatternMutationState;
  idmSettings: IDMTransformSettings;
  idmMutationState: IDMTransformMutationState;
  masterGain: number;
}

export const createProjectSnapshot = (
  input: ProjectSnapshotInput,
): SerializableCreativeProjectState | null => {
  if (!input.sourceToken || !input.metadata) return null;
  return {
    source: {
      token: input.sourceToken,
      decoded: {
        sampleRate: input.metadata.sampleRate,
        numberOfChannels: input.metadata.numberOfChannels,
        lengthSamples: input.sourceLengthSamples,
        durationSeconds: input.metadata.durationSeconds,
      },
    },
    editor: {
      markers: input.sliceHistory.markers,
      zeroCrossingEnabled: input.zeroCrossingEnabled,
      customDivision: input.customDivision,
      onsetSettings: input.onsetSettings,
      onsetApplyMode: input.onsetApplyMode,
    },
    sliceAnalysis: input.validSliceAnalysis
      ? { result: input.validSliceAnalysis, annotations: input.sliceAnnotations }
      : null,
    sequencer: {
      pattern: input.pattern,
      generatorSettings: input.generatorSettings,
      mutationState: input.mutationState,
      idmSettings: input.idmSettings,
      idmMutationState: input.idmMutationState,
      masterGain: input.masterGain,
    },
  };
};

export const stableProjectString = (state: SerializableCreativeProjectState | null): string =>
  state ? JSON.stringify(state) : '';

export const isSerializableCreativeProjectState = (
  value: unknown,
): value is SerializableCreativeProjectState => {
  const candidate = value as SerializableCreativeProjectState;
  return Boolean(
    candidate &&
    typeof candidate === 'object' &&
    candidate.source &&
    candidate.editor &&
    candidate.sequencer &&
    candidate.sequencer.pattern,
  );
};
