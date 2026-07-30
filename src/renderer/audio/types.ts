import type { SupportedAudioExtension } from '../../shared/types/app';

export interface AudioSourceMetadata {
  id: string;
  fileName: string;
  extension: SupportedAudioExtension;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  numberOfChannels: number;
  channelLabel: string;
  importedAt: number;
}

export interface ImportedAudioRuntime {
  metadata: AudioSourceMetadata;
  originalBuffer: AudioBuffer;
  analysisMonoData: Float32Array;
}

export type AudioImportState =
  | { status: 'empty' }
  | { status: 'reading'; fileName: string }
  | { status: 'decoding'; fileName: string }
  | { status: 'building-waveform'; fileName: string }
  | { status: 'ready'; sourceId: string }
  | { status: 'error'; message: string };

export type PlaybackStatus = 'unavailable' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  positionSeconds: number;
  durationSeconds: number;
  loopEnabled: boolean;
  masterGain: number;
}

export interface WaveformPeakLevel {
  samplesPerPeak: number;
  minimums: Float32Array;
  maximums: Float32Array;
}

export interface ChannelWaveformPeaks {
  channelIndex: number;
  levels: WaveformPeakLevel[];
}

export interface WaveformPeaks {
  durationSeconds: number;
  sampleRate: number;
  channels: ChannelWaveformPeaks[];
}
