import { describe, expect, it } from 'vitest';
import { decodePortableProject, encodePortableProject } from '../../shared/project/portable';
import type { DrumulizerProjectDocumentV1 } from '../../shared/project/schema';

const manifest: DrumulizerProjectDocumentV1 = {
  format: 'drumulizer-project',
  schemaVersion: 1,
  appVersion: '0.9.0',
  projectId: 'portable-1',
  projectName: 'Portable',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  source: {
    logicalSourceId: 'source-1',
    fileName: 'portable.wav',
    extension: 'wav',
    mimeType: 'audio/wav',
    byteLength: 4,
    sha256: 'b'.repeat(64),
    decoded: { sampleRate: 44100, numberOfChannels: 1, lengthSamples: 4, durationSeconds: 0.1 },
    reference: { kind: 'embedded', audioByteLength: 4 },
  },
  editor: { markers: [] },
  sliceAnalysis: null,
  sequencer: { pattern: { events: [] } },
};

describe('portable project container', () => {
  it('round trips manifest and original audio bytes deterministically', () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    const encoded = encodePortableProject(manifest, audio);
    const decoded = decodePortableProject(encoded);
    expect(decoded.manifest.projectId).toBe('portable-1');
    expect([...decoded.audioBytes]).toEqual([...audio]);
    expect([...encodePortableProject(manifest, audio)]).toEqual([...encoded]);
  });

  it('rejects invalid magic and truncated data', () => {
    const encoded = encodePortableProject(manifest, new Uint8Array([1, 2, 3, 4]));
    encoded[0] = 0;
    expect(() => decodePortableProject(encoded)).toThrow();
    expect(() => decodePortableProject(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
