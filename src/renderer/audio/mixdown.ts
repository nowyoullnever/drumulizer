export const createAnalysisMonoData = (buffer: AudioBuffer): Float32Array => {
  const { length, numberOfChannels } = buffer;
  if (numberOfChannels <= 0 || length <= 0) {
    throw new Error('오디오 채널이 없습니다.');
  }

  if (numberOfChannels === 1) {
    return new Float32Array(buffer.getChannelData(0));
  }

  const output = new Float32Array(length);
  const channelData = Array.from({ length: numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );

  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    let sum = 0;
    for (const channel of channelData) {
      sum += channel[sampleIndex] ?? 0;
    }
    const averaged = sum / numberOfChannels;
    output[sampleIndex] = Number.isFinite(averaged) ? Math.max(-1, Math.min(1, averaged)) : 0;
  }

  return output;
};
