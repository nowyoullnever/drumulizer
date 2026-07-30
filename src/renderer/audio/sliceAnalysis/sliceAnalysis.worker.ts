import { analyzeSlices } from './analyzeSlices';
import type { SliceAnalysisRequest, SliceAnalysisWorkerMessage } from './sliceAnalysisTypes';

self.addEventListener('message', (event: MessageEvent<SliceAnalysisRequest>) => {
  const request = event.data;
  try {
    const result = analyzeSlices(request, (progress) => {
      self.postMessage({
        type: 'progress',
        requestId: request.requestId,
        progress,
      } satisfies SliceAnalysisWorkerMessage);
    });
    self.postMessage({ type: 'complete', result } satisfies SliceAnalysisWorkerMessage);
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'Slice analysis failed.',
    } satisfies SliceAnalysisWorkerMessage);
  }
});
