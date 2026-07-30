import { detectOnsets } from './detectOnsets';
import type { OnsetAnalysisRequest, OnsetWorkerMessage } from './onsetTypes';

self.addEventListener('message', (event: MessageEvent<OnsetAnalysisRequest>) => {
  const request = event.data;
  try {
    const result = detectOnsets(request);
    self.postMessage({ type: 'complete', result } satisfies OnsetWorkerMessage);
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'Onset analysis failed.',
    } satisfies OnsetWorkerMessage);
  }
});
