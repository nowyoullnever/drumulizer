import type { SliceRegion } from '../../slice/types';
import { extractSliceFeatures } from './featureExtraction';
import { normalizeSliceFeatures } from './normalization';
import { scoreSliceRoles } from './roleScoring';
import type {
  SliceAnalysisRequest,
  SliceAnalysisResult,
  SliceAnalysisSummary,
} from './sliceAnalysisTypes';

export const sliceSetSignature = (
  sourceId: string | null | undefined,
  slices: SliceRegion[],
): string =>
  `${sourceId ?? 'no-source'}:${slices.map((slice) => `${slice.startSample}-${slice.endSample}`).join('|')}`;

export const analyzeSlices = (
  request: SliceAnalysisRequest,
  onProgress?: (progress: number) => void,
): SliceAnalysisResult => {
  const raw = request.slices.map((slice, index) => {
    onProgress?.((index / Math.max(1, request.slices.length * 2)) * 100);
    return extractSliceFeatures(request.monoData, request.originalSampleRate, slice);
  });
  const normalized = normalizeSliceFeatures(raw);
  const analyses = request.slices.map((slice, index) => {
    onProgress?.(((request.slices.length + index) / Math.max(1, request.slices.length * 2)) * 100);
    return scoreSliceRoles(slice.id, slice.index, raw[index], normalized[index]);
  });
  onProgress?.(100);

  return {
    requestId: request.requestId,
    sourceId: request.sourceId,
    sliceSetSignature: request.sliceSetSignature,
    analyses,
    summary: summarizeAnalyses(analyses),
  };
};

const summarizeAnalyses = (analyses: SliceAnalysisResult['analyses']): SliceAnalysisSummary => {
  const roleCounts: SliceAnalysisSummary['roleCounts'] = {
    low: 0,
    mid: 0,
    high: 0,
    texture: 0,
    unclassified: 0,
  };
  let warningCount = 0;
  for (const analysis of analyses) {
    roleCounts[analysis.automaticRole] += 1;
    warningCount += analysis.warnings.length;
  }
  return {
    total: analyses.length,
    analyzed: analyses.length,
    roleCounts,
    warningCount,
  };
};
