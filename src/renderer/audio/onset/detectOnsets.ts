import { robustLocalNormalize } from './adaptiveThreshold';
import { calculateEnvelopeFeatures } from './envelopes';
import {
  clampOnsetSettings,
  type OnsetAnalysisRequest,
  type OnsetAnalysisResult,
} from './onsetTypes';
import { mapAnalysisSampleToSource, preprocessOnsetPcm } from './preprocess';
import { pickPeaks } from './peakPicking';
import { analyzeSpectralFlux } from './spectralFlux';
import { dominantBandForFrame, enforceCandidateRules, refineOnsetSample } from './refineOnsets';

const SCORE_WEIGHTS = {
  low: 0.15,
  lowMid: 0.2,
  highMid: 0.25,
  high: 0.2,
  energyRise: 0.1,
  highFrequencyNovelty: 0.1,
};

const MINIMUM_TRANSIENT_CREST_FACTOR = 2.75;

export const detectOnsets = (request: OnsetAnalysisRequest): OnsetAnalysisResult => {
  const settings = clampOnsetSettings(request.settings);
  const preprocessed = preprocessOnsetPcm(request.monoData, request.originalSampleRate);
  if (preprocessed.silent || preprocessed.samples.length < preprocessed.frameSize) {
    return {
      requestId: request.requestId,
      candidates: [],
      settings,
      analysisSampleRate: preprocessed.analysisSampleRate,
      frameSize: preprocessed.frameSize,
      hopSize: preprocessed.hopSize,
      sourceLengthSamples: request.monoData.length,
      capped: false,
      diagnostics: {
        frameCount: 0,
        rawPeakCount: 0,
        gatedPeakCount: 0,
        finalCandidateCount: 0,
        durationSeconds: request.monoData.length / Math.max(1, request.originalSampleRate),
        candidateDensityPerSecond: 0,
        strongestBand: null,
        capped: false,
        denseSuppressionApplied: false,
      },
      reason: preprocessed.silent ? 'SILENT_SOURCE' : 'INVALID_SOURCE',
    };
  }

  const novelty = analyzeSpectralFlux(
    preprocessed.samples,
    preprocessed.analysisSampleRate,
    preprocessed.frameSize,
    preprocessed.hopSize,
  );
  const low = robustLocalNormalize(
    novelty.bandFlux.low,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const lowMid = robustLocalNormalize(
    novelty.bandFlux['low-mid'],
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const highMid = robustLocalNormalize(
    novelty.bandFlux['high-mid'],
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const high = robustLocalNormalize(
    novelty.bandFlux.high,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const energyRise = robustLocalNormalize(
    novelty.energyRise,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const highFrequencyNovelty = robustLocalNormalize(
    novelty.highFrequencyNovelty,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const envelopes = calculateEnvelopeFeatures(
    preprocessed.samples,
    preprocessed.analysisSampleRate,
    novelty.frameCount,
    preprocessed.hopSize,
  );
  const fastRise = robustLocalNormalize(
    envelopes.fastRise,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const slowContrast = robustLocalNormalize(
    envelopes.slowContrast,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const lowEnvelopeRise = robustLocalNormalize(
    envelopes.lowEnvelopeRise,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const combined = new Float32Array(novelty.frameCount);
  const supportCounts = new Uint8Array(novelty.frameCount);
  for (let index = 0; index < combined.length; index += 1) {
    const supportCount =
      Number(low[index] > 1.2) +
      Number(lowMid[index] > 1.2) +
      Number(highMid[index] > 1.2) +
      Number(high[index] > 1.2) +
      Number(fastRise[index] + slowContrast[index] > 1.4) +
      Number(lowEnvelopeRise[index] > 1.5);
    supportCounts[index] = supportCount;
    const transientEvidence =
      0.28 * fastRise[index] +
      0.2 * slowContrast[index] +
      0.16 * lowEnvelopeRise[index] +
      0.16 * highFrequencyNovelty[index] +
      0.12 * energyRise[index] +
      0.08 * supportCount;
    const transientGate =
      transientEvidence > 0.85 ||
      fastRise[index] + slowContrast[index] > 1.8 ||
      lowEnvelopeRise[index] > 2.1
        ? 1
        : 0;
    combined[index] =
      transientGate *
      (SCORE_WEIGHTS.low * low[index] +
        SCORE_WEIGHTS.lowMid * lowMid[index] +
        SCORE_WEIGHTS.highMid * highMid[index] +
        SCORE_WEIGHTS.high * high[index] +
        SCORE_WEIGHTS.energyRise * energyRise[index] +
        SCORE_WEIGHTS.highFrequencyNovelty * highFrequencyNovelty[index] +
        0.18 * transientEvidence);
  }

  const rawPeaks = pickPeaks(
    combined,
    settings.sensitivity,
    settings.minimumGapMs,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const peaks = suppressDenseWeakPeaks(
    suppressPostRingPeaks(rawPeaks, preprocessed.analysisSampleRate, preprocessed.hopSize),
    combined,
    supportCounts,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const crestFactor = calculateCrestFactor(request.monoData);
  const candidates = (crestFactor < MINIMUM_TRANSIENT_CREST_FACTOR ? [] : peaks)
    .filter(
      (peak) =>
        peak.prominence > 0.35 &&
        (supportCounts[peak.frameIndex] >= 1 ||
          fastRise[peak.frameIndex] + slowContrast[peak.frameIndex] > 1.8 ||
          lowEnvelopeRise[peak.frameIndex] > 2.1),
    )
    .map((peak) => {
      const coarseAnalysisSample =
        peak.frameIndex * preprocessed.hopSize + preprocessed.frameSize / 2;
      const coarseSourceSample = mapAnalysisSampleToSource(
        coarseAnalysisSample,
        preprocessed.analysisToSourceRatio,
        preprocessed.sourceLengthSamples,
      );
      const sampleIndex = refineOnsetSample(
        request.monoData,
        request.originalSampleRate,
        coarseSourceSample,
      );
      return {
        id: '',
        sampleIndex,
        timeSeconds: sampleIndex / request.originalSampleRate,
        confidence: calibrateConfidence({
          score: peak.score,
          threshold: 1,
          prominence: peak.prominence,
          attackEvidence: fastRise[peak.frameIndex] + slowContrast[peak.frameIndex],
          supportCount: supportCounts[peak.frameIndex],
        }),
        score: peak.score,
        prominence: peak.prominence,
        supportCount: supportCounts[peak.frameIndex],
        dominantBand: dominantBandForFrame(novelty.bandFlux, peak.frameIndex),
      };
    });
  const enforced = enforceCandidateRules(
    candidates,
    request.monoData.length,
    request.originalSampleRate,
    settings.minimumGapMs,
  );

  return {
    requestId: request.requestId,
    candidates: enforced.candidates,
    settings,
    analysisSampleRate: preprocessed.analysisSampleRate,
    frameSize: preprocessed.frameSize,
    hopSize: preprocessed.hopSize,
    sourceLengthSamples: request.monoData.length,
    capped: enforced.capped,
    diagnostics: {
      frameCount: novelty.frameCount,
      rawPeakCount: rawPeaks.length,
      gatedPeakCount: peaks.length,
      finalCandidateCount: enforced.candidates.length,
      durationSeconds: request.monoData.length / request.originalSampleRate,
      candidateDensityPerSecond:
        enforced.candidates.length /
        Math.max(0.001, request.monoData.length / request.originalSampleRate),
      strongestBand: strongestBand(enforced.candidates),
      capped: enforced.capped,
      denseSuppressionApplied: peaks.length < rawPeaks.length,
    },
    reason: enforced.capped ? 'CANDIDATE_LIMIT_REACHED' : undefined,
  };
};

const calculateCrestFactor = (samples: Float32Array): number => {
  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Number.isFinite(samples[index]) ? samples[index] : 0;
    peak = Math.max(peak, Math.abs(value));
    sumSquares += value * value;
  }
  return peak / (Math.sqrt(sumSquares / Math.max(1, samples.length)) + 0.000001);
};

export const calibrateConfidence = (input: {
  score: number;
  threshold: number;
  prominence: number;
  attackEvidence: number;
  supportCount: number;
}): number => {
  const thresholdEvidence = Math.max(0, Math.min(1, (input.score - input.threshold) / 5));
  const prominenceEvidence = Math.max(0, Math.min(1, input.prominence / 5));
  const attackEvidence = Math.max(0, Math.min(1, input.attackEvidence / 5));
  const supportEvidence = Math.max(0, Math.min(1, input.supportCount / 4));
  return Math.max(
    0,
    Math.min(
      1,
      thresholdEvidence * 0.35 +
        prominenceEvidence * 0.25 +
        attackEvidence * 0.25 +
        supportEvidence * 0.15,
    ),
  );
};

const suppressPostRingPeaks = (
  peaks: ReturnType<typeof pickPeaks>,
  sampleRate: number,
  hopSize: number,
): ReturnType<typeof pickPeaks> => {
  const minRingGap = Math.round((sampleRate * 70) / 1000 / hopSize);
  const maxRingGap = Math.round((sampleRate * 145) / 1000 / hopSize);
  return peaks.filter((peak, index) => {
    const previous = peaks[index - 1];
    if (!previous) return true;
    const gap = peak.frameIndex - previous.frameIndex;
    if (gap < minRingGap || gap > maxRingGap) return true;
    return peak.score >= previous.score * 0.12;
  });
};

const suppressDenseWeakPeaks = (
  peaks: ReturnType<typeof pickPeaks>,
  combined: Float32Array,
  supportCounts: Uint8Array,
  sampleRate: number,
  hopSize: number,
): ReturnType<typeof pickPeaks> => {
  const radius = Math.max(1, Math.round((sampleRate * 900) / 1000 / hopSize));
  const filtered = peaks.filter((peak) => {
    let localCount = 0;
    let localBest = peak.score;
    for (const candidate of peaks) {
      if (Math.abs(candidate.frameIndex - peak.frameIndex) <= radius) {
        localCount += 1;
        localBest = Math.max(localBest, candidate.score);
      }
    }
    if (localCount < 8) return true;
    return (
      peak.score >= localBest * 0.08 ||
      peak.prominence > 24 ||
      (combined[peak.frameIndex] > 12 && supportCounts[peak.frameIndex] >= 3)
    );
  });
  if (filtered.length <= 8) return filtered;

  const firstFrame = filtered[0].frameIndex;
  const lastFrame = filtered[filtered.length - 1].frameIndex;
  const spanSeconds = ((lastFrame - firstFrame + 1) * hopSize) / sampleRate;
  const denseBudget = Math.max(8, Math.ceil(spanSeconds * 8));
  if (filtered.length <= denseBudget) return filtered;

  const retained = new Set(
    [...filtered]
      .sort((left, right) => right.score + right.prominence - (left.score + left.prominence))
      .slice(0, denseBudget)
      .map((peak) => peak.frameIndex),
  );
  return filtered.filter((peak) => retained.has(peak.frameIndex));
};

const strongestBand = (candidates: { dominantBand: string }[]) => {
  if (candidates.length === 0) return null;
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.dominantBand, (counts.get(candidate.dominantBand) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0] as ReturnType<
    typeof dominantBandForFrame
  >;
};
