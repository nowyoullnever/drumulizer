import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnsetWorkerClient } from '../audio/onset/onsetWorkerClient';
import type { OnsetWorkerMessage } from '../audio/onset/onsetTypes';

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: MessageEvent<OnsetWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  constructor() {
    MockWorker.instances.push(this);
  }

  postMessage(): void {}

  terminate(): void {
    this.terminated = true;
  }
}

describe('onset worker client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockWorker.instances = [];
  });

  it('terminates stale work when a new analysis starts', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new OnsetWorkerClient();
    void client.analyze({
      requestId: 'first',
      monoData: new Float32Array([0, 1, 0]),
      originalSampleRate: 24000,
      settings: { sensitivity: 55, minimumGapMs: 45 },
    });
    expect(MockWorker.instances[0].terminated).toBe(false);
    const promise = client.analyze({
      requestId: 'second',
      monoData: new Float32Array([0, 1, 0]),
      originalSampleRate: 24000,
      settings: { sensitivity: 55, minimumGapMs: 45 },
    });
    expect(MockWorker.instances[0].terminated).toBe(true);
    MockWorker.instances[1].onmessage?.({
      data: {
        type: 'complete',
        result: {
          requestId: 'second',
          candidates: [],
          settings: { sensitivity: 55, minimumGapMs: 45 },
          analysisSampleRate: 24000,
          frameSize: 512,
          hopSize: 128,
          sourceLengthSamples: 3,
          capped: false,
        },
      },
    } as unknown as MessageEvent<OnsetWorkerMessage>);
    await expect(promise).resolves.toMatchObject({ requestId: 'second' });
  });
});
