import { buildChannelPeaks } from './waveformPeaks';

interface PeakWorkerRequest {
  channels: Float32Array[];
  sampleRate: number;
  durationSeconds: number;
}

self.onmessage = (event: MessageEvent<PeakWorkerRequest>): void => {
  const { channels, sampleRate, durationSeconds } = event.data;
  const peaks = channels.map((channel, index) => buildChannelPeaks(channel, index));
  self.postMessage({ durationSeconds, sampleRate, channels: peaks });
};
