import type { OnsetAnalysisRequest, OnsetAnalysisResult, OnsetWorkerMessage } from './onsetTypes';

export class OnsetWorkerClient {
  private worker: Worker | null = null;
  private activeRequestId: string | null = null;

  analyze(
    request: OnsetAnalysisRequest,
    onProgress?: (progress: number) => void,
  ): Promise<OnsetAnalysisResult> {
    this.cancel();
    this.activeRequestId = request.requestId;
    this.worker = new Worker(new URL('./onset.worker.ts', import.meta.url), { type: 'module' });

    return new Promise((resolve, reject) => {
      const worker = this.worker;
      if (!worker) {
        reject(new Error('Onset worker unavailable.'));
        return;
      }

      worker.onmessage = (event: MessageEvent<OnsetWorkerMessage>) => {
        const message = event.data;
        if ('requestId' in message && message.requestId !== this.activeRequestId) return;
        if (message.type === 'progress') {
          onProgress?.(message.progress);
          return;
        }
        this.cleanup();
        if (message.type === 'complete') resolve(message.result);
        else reject(new Error(message.message));
      };
      worker.onerror = (event) => {
        this.cleanup();
        reject(new Error(event.message));
      };

      const monoCopy = new Float32Array(request.monoData);
      worker.postMessage({ ...request, monoData: monoCopy }, [monoCopy.buffer]);
    });
  }

  cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.worker?.terminate();
    this.worker = null;
    this.activeRequestId = null;
  }
}
