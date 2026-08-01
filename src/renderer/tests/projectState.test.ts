import { describe, expect, it } from 'vitest';
import { createProjectSnapshot, stableProjectString } from '../project/projectState';
import { createDefaultPattern } from '../sequencer/patternModel';
import {
  createDefaultGeneratorSettings,
  createDefaultMutationState,
} from '../sequencer/generator/generatorTypes';
import {
  createDefaultIDMTransformMutationState,
  createDefaultIDMTransformSettings,
} from '../sequencer/transform/idmTransform';

const snapshotInput = () => ({
  sourceToken: 'token-1',
  metadata: {
    id: 'source-1',
    fileName: 'synthetic.wav',
    extension: 'wav' as const,
    mimeType: 'audio/wav',
    fileSizeBytes: 128,
    durationSeconds: 1,
    sampleRate: 48000,
    numberOfChannels: 2,
    channelLabel: 'STEREO',
    importedAt: 1,
  },
  sourceLengthSamples: 48000,
  sliceHistory: { markers: [], selectedMarkerId: null, selectedSliceId: '' },
  zeroCrossingEnabled: true,
  customDivision: 8,
  onsetSettings: { sensitivity: 45, minimumGapMs: 60 },
  onsetApplyMode: 'replace' as const,
  validSliceAnalysis: null,
  sliceAnnotations: { overrides: {}, excluded: {} },
  pattern: createDefaultPattern(),
  generatorSettings: createDefaultGeneratorSettings(),
  mutationState: createDefaultMutationState(),
  idmSettings: createDefaultIDMTransformSettings(),
  idmMutationState: createDefaultIDMTransformMutationState(),
  masterGain: 0.75,
});

describe('project dirty state snapshots', () => {
  it('serializes creative state deterministically', () => {
    const left = stableProjectString(createProjectSnapshot(snapshotInput()));
    const right = stableProjectString(createProjectSnapshot(snapshotInput()));
    expect(left).toBe(right);
    expect(left).toContain('token-1');
  });

  it('does not require noncreative selection data', () => {
    const input = snapshotInput();
    const clean = stableProjectString(createProjectSnapshot(input));
    const changed = stableProjectString(createProjectSnapshot({ ...input, customDivision: 12 }));
    expect(changed).not.toBe(clean);
  });
});
