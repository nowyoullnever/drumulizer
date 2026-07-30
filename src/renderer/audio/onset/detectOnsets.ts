import { robustLocalNormalize } from './adaptiveThreshold';
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
  const combined = new Float32Array(novelty.frameCount);
  for (let index = 0; index < combined.length; index += 1) {
    const transientGate = novelty.energyRise[index] > 0.02 ? 1 : 0;
    combined[index] =
      transientGate *
      (SCORE_WEIGHTS.low * low[index] +
        SCORE_WEIGHTS.lowMid * lowMid[index] +
        SCORE_WEIGHTS.highMid * highMid[index] +
        SCORE_WEIGHTS.high * high[index] +
        SCORE_WEIGHTS.energyRise * energyRise[index] +
        SCORE_WEIGHTS.highFrequencyNovelty * highFrequencyNovelty[index]);
  }

  const peaks = pickPeaks(
    combined,
    settings.sensitivity,
    settings.minimumGapMs,
    preprocessed.analysisSampleRate,
    preprocessed.hopSize,
  );
  const maxScore = Math.max(1, ...peaks.map((peak) => peak.score));
  const candidates = peaks.map((peak) => {
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
      confidence: Math.max(0, Math.min(1, peak.score / maxScore)),
      score: peak.score,
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
    reason: enforced.capped ? 'CANDIDATE_LIMIT_REACHED' : undefined,
  };
};
