import {
  sequencerLaneOrder,
  type SequencerLaneId,
  type SequencerPattern,
} from '../sequencer/types';
import { patternDurationSeconds, scheduleWindow } from '../sequencer/schedulerMath';
import type { SliceRegion } from '../slice/types';
import { encodeStereoWav, type WavEncodeDiagnostics } from './wavEncoder';

export type RenderMode = 'seamless-loop' | 'performance';
export type ExportOutputMode = 'mix' | 'stems' | 'mix-and-stems';

export interface OfflineRenderOptions {
  mode: RenderMode;
  loops: number;
  sampleRate: number;
  bitDepth: 16 | 24;
  normalize: boolean;
  includeTail: boolean;
  seed: string;
  masterGain: number;
}

export interface StereoBuffer {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

export interface OfflineRenderDiagnostics {
  plannedVoices: number;
  duplicateVoiceKeys: number;
  invalidSourceOffsets: number;
  invalidAudioTimes: number;
  probabilitySkipped: number;
  granularFallbacks: number;
  clippedSamples: number;
  peak: number;
  durationSeconds: number;
}

export interface ExportedWavFile {
  fileName: string;
  bytes: ArrayBuffer;
  diagnostics: OfflineRenderDiagnostics;
}

const outputLengthSeconds = (pattern: SequencerPattern, options: OfflineRenderOptions): number => {
  const base = patternDurationSeconds(pattern) * Math.max(1, Math.floor(options.loops));
  return options.mode === 'performance' && options.includeTail ? base + 1 : base;
};

const applyVoice = (input: {
  output: StereoBuffer;
  sourceChannels: Float32Array[];
  sourceSampleRate: number;
  slice: SliceRegion;
  voice: ReturnType<typeof scheduleWindow>['scheduled'][number];
  renderStartSeconds: number;
}): number => {
  const output = input.output;
  const startSample = Math.round(
    (input.voice.audioTimeSeconds - input.renderStartSeconds) * output.sampleRate,
  );
  const durationSamples = Math.max(0, Math.round(input.voice.durationSeconds * output.sampleRate));
  const gain = input.voice.eventGain * input.voice.laneGain;
  const leftGain = gain * (input.voice.pan <= 0 ? 1 : 1 - input.voice.pan);
  const rightGain = gain * (input.voice.pan >= 0 ? 1 : 1 + input.voice.pan);
  const leftSource = input.sourceChannels[0];
  const rightSource = input.sourceChannels[1] ?? input.sourceChannels[0];
  let invalid = 0;
  for (let index = 0; index < durationSamples; index += 1) {
    const outIndex = startSample + index;
    if (outIndex < 0 || outIndex >= output.left.length) continue;
    const progressedSeconds = (index / output.sampleRate) * input.voice.playbackRate;
    const sourceSeconds = input.voice.reverse
      ? input.slice.endSeconds -
        (input.voice.offsetSeconds - input.slice.startSeconds) -
        progressedSeconds
      : input.voice.offsetSeconds + progressedSeconds;
    const sourceSample = sourceSeconds * input.sourceSampleRate;
    if (sourceSample < 0 || sourceSample >= leftSource.length - 1) {
      invalid += 1;
      continue;
    }
    const fadeIn =
      input.voice.fadeSeconds > 0
        ? Math.min(1, index / (input.voice.fadeSeconds * output.sampleRate))
        : 1;
    const fadeOut =
      input.voice.fadeSeconds > 0
        ? Math.min(1, (durationSamples - index) / (input.voice.fadeSeconds * output.sampleRate))
        : 1;
    const fade = Math.min(fadeIn, fadeOut);
    const low = Math.floor(sourceSample);
    const high = low + 1;
    const fraction = sourceSample - low;
    const l = (leftSource[low] * (1 - fraction) + leftSource[high] * fraction) * fade;
    const r = (rightSource[low] * (1 - fraction) + rightSource[high] * fraction) * fade;
    output.left[outIndex] += l * leftGain;
    output.right[outIndex] += r * rightGain;
  }
  return invalid;
};

export const renderPatternToStereo = (input: {
  pattern: SequencerPattern;
  slices: SliceRegion[];
  sourceBuffer: AudioBuffer;
  options: OfflineRenderOptions;
  laneFilter?: SequencerLaneId;
}): { buffer: StereoBuffer; diagnostics: OfflineRenderDiagnostics } => {
  const pattern = input.laneFilter
    ? {
        ...input.pattern,
        events: input.pattern.events.filter((event) => event.laneId === input.laneFilter),
      }
    : input.pattern;
  const durationSeconds = outputLengthSeconds(pattern, input.options);
  const length = Math.max(1, Math.ceil(durationSeconds * input.options.sampleRate));
  const output: StereoBuffer = {
    left: new Float32Array(length),
    right: new Float32Array(length),
    sampleRate: input.options.sampleRate,
  };
  const sourceChannels = Array.from({ length: input.sourceBuffer.numberOfChannels }, (_, index) =>
    input.sourceBuffer.getChannelData(index),
  );
  const scheduledKeys = new Set<string>();
  const plan = scheduleWindow({
    pattern: { ...pattern, loopEnabled: true },
    slices: input.slices,
    windowStartSeconds: 0,
    windowEndSeconds: durationSeconds,
    transportOriginSeconds: 0,
    scheduledKeys,
    masterGain: input.options.masterGain,
    seed: input.options.seed,
    maxVoices: 8192,
  });
  let invalidSourceOffsets = 0;
  const sourceSlices = new Map(input.slices.map((slice) => [slice.id, slice]));
  const eventToSlice = new Map(pattern.events.map((event) => [event.id, event.sliceId]));
  for (const voice of plan.scheduled) {
    const sliceId = eventToSlice.get(voice.eventId);
    const slice = sliceId ? sourceSlices.get(sliceId) : null;
    if (!slice) {
      invalidSourceOffsets += 1;
      continue;
    }
    invalidSourceOffsets += applyVoice({
      output,
      sourceChannels,
      sourceSampleRate: input.sourceBuffer.sampleRate,
      slice,
      voice,
      renderStartSeconds: 0,
    });
  }
  let peak = 0;
  for (let index = 0; index < output.left.length; index += 1) {
    peak = Math.max(peak, Math.abs(output.left[index]), Math.abs(output.right[index]));
  }
  if (input.options.normalize && peak > 1) {
    const scalar = 1 / peak;
    for (let index = 0; index < output.left.length; index += 1) {
      output.left[index] *= scalar;
      output.right[index] *= scalar;
    }
    peak = 1;
  }
  return {
    buffer: output,
    diagnostics: {
      plannedVoices: plan.scheduled.length,
      duplicateVoiceKeys: plan.duplicateSkipped,
      invalidSourceOffsets,
      invalidAudioTimes: 0,
      probabilitySkipped: plan.probabilitySkipped,
      granularFallbacks: plan.granularFallbacks,
      clippedSamples: 0,
      peak,
      durationSeconds,
    },
  };
};

const mergeDiagnostics = (
  render: OfflineRenderDiagnostics,
  wav: WavEncodeDiagnostics,
): OfflineRenderDiagnostics => ({
  ...render,
  clippedSamples: wav.clippedSamples,
  peak: Math.max(render.peak, wav.peak),
});

export const exportPatternWavs = (input: {
  baseName: string;
  pattern: SequencerPattern;
  slices: SliceRegion[];
  sourceBuffer: AudioBuffer;
  outputMode: ExportOutputMode;
  options: OfflineRenderOptions;
}): ExportedWavFile[] => {
  const files: ExportedWavFile[] = [];
  const renderFile = (suffix: string, laneFilter?: SequencerLaneId): void => {
    const rendered = renderPatternToStereo({ ...input, laneFilter });
    const encoded = encodeStereoWav(rendered.buffer.left, rendered.buffer.right, input.options);
    files.push({
      fileName: `${input.baseName}${suffix}.wav`,
      bytes: encoded.bytes,
      diagnostics: mergeDiagnostics(rendered.diagnostics, encoded.diagnostics),
    });
  };
  if (input.outputMode === 'mix' || input.outputMode === 'mix-and-stems') renderFile('-mix');
  if (input.outputMode === 'stems' || input.outputMode === 'mix-and-stems') {
    for (const lane of sequencerLaneOrder) renderFile(`-${lane}`, lane);
  }
  return files;
};

export const exportSliceWav = (input: {
  fileName: string;
  sourceBuffer: AudioBuffer;
  slice: SliceRegion;
  bitDepth: 16 | 24;
  sampleRate: number;
}): ExportedWavFile => {
  const length = Math.max(1, Math.round(input.slice.durationSeconds * input.sampleRate));
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const sourceLeft = input.sourceBuffer.getChannelData(0);
  const sourceRight =
    input.sourceBuffer.numberOfChannels > 1 ? input.sourceBuffer.getChannelData(1) : sourceLeft;
  for (let index = 0; index < length; index += 1) {
    const sourceIndex =
      input.slice.startSample + (index / input.sampleRate) * input.sourceBuffer.sampleRate;
    const low = Math.floor(sourceIndex);
    const high = Math.min(sourceLeft.length - 1, low + 1);
    const fraction = sourceIndex - low;
    const fade = Math.min(1, index / 64, (length - index) / 64);
    left[index] = (sourceLeft[low] * (1 - fraction) + sourceLeft[high] * fraction) * fade;
    right[index] = (sourceRight[low] * (1 - fraction) + sourceRight[high] * fraction) * fade;
  }
  const encoded = encodeStereoWav(left, right, {
    sampleRate: input.sampleRate,
    bitDepth: input.bitDepth,
  });
  return {
    fileName: input.fileName,
    bytes: encoded.bytes,
    diagnostics: {
      plannedVoices: 0,
      duplicateVoiceKeys: 0,
      invalidSourceOffsets: 0,
      invalidAudioTimes: 0,
      probabilitySkipped: 0,
      granularFallbacks: 0,
      clippedSamples: encoded.diagnostics.clippedSamples,
      peak: encoded.diagnostics.peak,
      durationSeconds: input.slice.durationSeconds,
    },
  };
};
