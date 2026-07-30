import type { WaveformPeaks } from './types';

export const buildWaveformPeaksInWorker = async (buffer: AudioBuffer): Promise<WaveformPeaks> => {
  const visibleChannelCount = Math.min(buffer.numberOfChannels, 2);
  const channels = Array.from(
    { length: visibleChannelCount },
    (_, index) => new Float32Array(buffer.getChannelData(index)),
  );

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./waveformPeak.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<WaveformPeaks>): void => {
      worker.terminate();
      resolve(event.data);
    };

    worker.onerror = (): void => {
      worker.terminate();
      reject(new Error('파형 데이터를 만들지 못했습니다.'));
    };

    worker.postMessage({
      channels,
      sampleRate: buffer.sampleRate,
      durationSeconds: buffer.duration,
    });
  });
};
