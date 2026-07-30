import { DEFAULT_AUDITION_FADE_MS, MAX_AUDITION_PREROLL_MS } from '../../shared/constants/slice';

export const clampFadeSeconds = (
  durationSeconds: number,
  fadeMs = DEFAULT_AUDITION_FADE_MS,
): number => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const requested = Math.max(0, fadeMs) / 1000;
  return Math.min(requested, durationSeconds * 0.25);
};

export const clampPrerollSeconds = (startSeconds: number, prerollMs: number): number => {
  const requested = Math.max(0, Math.min(MAX_AUDITION_PREROLL_MS, prerollMs)) / 1000;
  return Math.min(requested, Math.max(0, startSeconds));
};

export const computeAuditionRegion = (input: {
  startSeconds: number;
  endSeconds: number;
  prerollMs: number;
}) => {
  const durationSeconds = Math.max(0, input.endSeconds - input.startSeconds);
  const prerollSeconds = clampPrerollSeconds(input.startSeconds, input.prerollMs);
  return {
    offsetSeconds: Math.max(0, input.startSeconds - prerollSeconds),
    durationSeconds: durationSeconds + prerollSeconds,
    sliceDurationSeconds: durationSeconds,
    fadeSeconds: clampFadeSeconds(durationSeconds),
    prerollSeconds,
  };
};

export const computeCandidateAuditionRegion = (input: {
  sampleIndex: number;
  sampleRate: number;
  sourceDurationSeconds?: number;
  preMs?: number;
  postMs?: number;
}) => {
  const sampleRate =
    Number.isFinite(input.sampleRate) && input.sampleRate > 0 ? input.sampleRate : 1;
  const centerSeconds = Math.max(0, input.sampleIndex) / sampleRate;
  const sourceEndSeconds =
    input.sourceDurationSeconds !== undefined && Number.isFinite(input.sourceDurationSeconds)
      ? Math.max(0, input.sourceDurationSeconds)
      : Number.POSITIVE_INFINITY;
  return computeAuditionRegion({
    startSeconds: Math.min(centerSeconds, sourceEndSeconds),
    endSeconds: Math.min(centerSeconds + Math.max(0, input.postMs ?? 120) / 1000, sourceEndSeconds),
    prerollMs: input.preMs ?? 20,
  });
};
