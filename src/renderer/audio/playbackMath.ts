import { clamp } from './time';

export const calculatePlaybackPosition = (
  contextTime: number,
  startContextTime: number,
  startOffset: number,
  duration: number,
  loopEnabled: boolean,
): number => {
  const elapsed = Math.max(0, contextTime - startContextTime);
  const raw = startOffset + elapsed;
  if (loopEnabled && duration > 0) return raw % duration;
  return clamp(raw, 0, duration);
};

export const calculatePauseOffset = (
  contextTime: number,
  startContextTime: number,
  startOffset: number,
  duration: number,
): number => clamp(startOffset + Math.max(0, contextTime - startContextTime), 0, duration);

export const clampSeek = (position: number, duration: number): number =>
  clamp(position, 0, duration);

export const isEndOfFile = (position: number, duration: number): boolean =>
  duration > 0 && position >= duration;
