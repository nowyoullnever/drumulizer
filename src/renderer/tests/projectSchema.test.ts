import { describe, expect, it } from 'vitest';
import { migrateProjectDocument } from '../../shared/project/schema';

const validDocument = () => ({
  format: 'drumulizer-project',
  schemaVersion: 1,
  appVersion: '0.9.0',
  projectId: 'project-1',
  projectName: 'Synthetic',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  source: {
    logicalSourceId: 'source-1',
    fileName: 'synthetic.wav',
    extension: 'wav',
    mimeType: 'audio/wav',
    byteLength: 128,
    sha256: 'a'.repeat(64),
    decoded: {
      sampleRate: 48000,
      numberOfChannels: 2,
      lengthSamples: 48000,
      durationSeconds: 1,
    },
    reference: {
      kind: 'linked',
      absolutePath: 'C:/audio/synthetic.wav',
      relativePath: 'synthetic.wav',
    },
  },
  editor: { markers: [] },
  sliceAnalysis: null,
  sequencer: { pattern: { events: [] } },
});

describe('project schema validation', () => {
  it('accepts schema v1 and rejects unsafe keys', () => {
    expect(migrateProjectDocument(validDocument()).schemaVersion).toBe(1);
    expect(() =>
      migrateProjectDocument(
        JSON.parse(
          JSON.stringify({
            ...validDocument(),
            editor: { ['__proto__']: { polluted: true } },
          }),
        ),
      ),
    ).toThrow();
  });

  it('rejects unsupported schema versions and invalid hashes', () => {
    expect(() => migrateProjectDocument({ ...validDocument(), schemaVersion: 2 })).toThrow();
    expect(() =>
      migrateProjectDocument({
        ...validDocument(),
        source: { ...validDocument().source, sha256: 'not-a-hash' },
      }),
    ).toThrow();
  });
});
