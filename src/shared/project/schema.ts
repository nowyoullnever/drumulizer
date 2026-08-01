import { MAX_AUDIO_FILE_BYTES } from '../constants/audio';
import { PROJECT_FORMAT_ID, PROJECT_SCHEMA_VERSION } from '../constants/project';
import type { SupportedAudioExtension } from '../types/app';

export type ProjectSourceReference =
  | { kind: 'linked'; absolutePath: string; relativePath: string | null }
  | { kind: 'embedded'; audioByteLength: number };

export interface ProjectSourceDescriptor {
  logicalSourceId: string;
  fileName: string;
  extension: SupportedAudioExtension;
  mimeType: string;
  byteLength: number;
  sha256: string;
  decoded: {
    sampleRate: number;
    numberOfChannels: number;
    lengthSamples: number;
    durationSeconds: number;
  };
  reference: ProjectSourceReference;
}

export interface DrumulizerProjectDocumentV1 {
  format: 'drumulizer-project';
  schemaVersion: 1;
  appVersion: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  source: ProjectSourceDescriptor;
  editor: unknown;
  sliceAnalysis: unknown | null;
  sequencer: unknown;
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

const MAX_STRING_LENGTH = 4096;
const MAX_ID_LENGTH = 128;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasUnsafeKey = (value: unknown, depth = 0): boolean => {
  if (depth > 32) return true;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeKey(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.keys(value).some(
    (key) =>
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype' ||
      hasUnsafeKey(value[key], depth + 1),
  );
};

const stringValue = (value: unknown, name: string, max = MAX_STRING_LENGTH): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new ProjectValidationError(`Invalid ${name}`);
  }
  return value;
};

const optionalStringValue = (value: unknown, name: string): string | null => {
  if (value === null) return null;
  return stringValue(value, name);
};

const finiteNumber = (value: unknown, name: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ProjectValidationError(`Invalid ${name}`);
  }
  return value;
};

const timestampValue = (value: unknown, name: string): string => {
  const timestamp = stringValue(value, name, 64);
  if (Number.isNaN(Date.parse(timestamp))) throw new ProjectValidationError(`Invalid ${name}`);
  return timestamp;
};

const hashValue = (value: unknown): string => {
  const hash = stringValue(value, 'source.sha256', 64);
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new ProjectValidationError('Invalid source.sha256');
  return hash;
};

export const sanitizeProjectState = (value: unknown): unknown => {
  if (hasUnsafeKey(value)) throw new ProjectValidationError('Unsafe project keys');
  JSON.stringify(value);
  return value;
};

export const validateProjectSourceDescriptor = (value: unknown): ProjectSourceDescriptor => {
  if (!isRecord(value)) throw new ProjectValidationError('Invalid source');
  const extension = stringValue(value.extension, 'source.extension', 8);
  if (extension !== 'wav' && extension !== 'mp3') {
    throw new ProjectValidationError('Invalid source.extension');
  }
  const decoded = value.decoded;
  if (!isRecord(decoded)) throw new ProjectValidationError('Invalid source.decoded');
  const reference = value.reference;
  if (!isRecord(reference)) throw new ProjectValidationError('Invalid source.reference');
  const referenceKind = stringValue(reference.kind, 'source.reference.kind', 16);
  const byteLength = finiteNumber(value.byteLength, 'source.byteLength', 1, MAX_AUDIO_FILE_BYTES);
  const validatedReference =
    referenceKind === 'linked'
      ? {
          kind: 'linked' as const,
          absolutePath: stringValue(reference.absolutePath, 'source.reference.absolutePath'),
          relativePath: optionalStringValue(
            reference.relativePath,
            'source.reference.relativePath',
          ),
        }
      : referenceKind === 'embedded'
        ? {
            kind: 'embedded' as const,
            audioByteLength: finiteNumber(
              reference.audioByteLength,
              'source.reference.audioByteLength',
              1,
              MAX_AUDIO_FILE_BYTES,
            ),
          }
        : null;
  if (!validatedReference) throw new ProjectValidationError('Invalid source.reference.kind');
  return {
    logicalSourceId: stringValue(value.logicalSourceId, 'source.logicalSourceId', MAX_ID_LENGTH),
    fileName: stringValue(value.fileName, 'source.fileName', 512),
    extension,
    mimeType: stringValue(value.mimeType, 'source.mimeType', 128),
    byteLength,
    sha256: hashValue(value.sha256),
    decoded: {
      sampleRate: finiteNumber(decoded.sampleRate, 'source.decoded.sampleRate', 1, 384000),
      numberOfChannels: finiteNumber(
        decoded.numberOfChannels,
        'source.decoded.numberOfChannels',
        1,
        32,
      ),
      lengthSamples: finiteNumber(
        decoded.lengthSamples,
        'source.decoded.lengthSamples',
        1,
        2 ** 53,
      ),
      durationSeconds: finiteNumber(
        decoded.durationSeconds,
        'source.decoded.durationSeconds',
        0.000001,
        24 * 60 * 60,
      ),
    },
    reference: validatedReference,
  };
};

export const validateProjectDocumentV1 = (value: unknown): DrumulizerProjectDocumentV1 => {
  if (hasUnsafeKey(value) || !isRecord(value)) throw new ProjectValidationError('Invalid project');
  if (value.format !== PROJECT_FORMAT_ID) throw new ProjectValidationError('Invalid format');
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectValidationError('Unsupported schema version');
  }
  const editor = sanitizeProjectState(value.editor);
  const sequencer = sanitizeProjectState(value.sequencer);
  const sliceAnalysis =
    value.sliceAnalysis === null ? null : sanitizeProjectState(value.sliceAnalysis);
  return {
    format: PROJECT_FORMAT_ID,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    appVersion: stringValue(value.appVersion, 'appVersion', 64),
    projectId: stringValue(value.projectId, 'projectId', MAX_ID_LENGTH),
    projectName: stringValue(value.projectName, 'projectName', 512),
    createdAt: timestampValue(value.createdAt, 'createdAt'),
    updatedAt: timestampValue(value.updatedAt, 'updatedAt'),
    source: validateProjectSourceDescriptor(value.source),
    editor,
    sliceAnalysis,
    sequencer,
  };
};

export const migrateProjectDocument = (unknownDocument: unknown): DrumulizerProjectDocumentV1 => {
  if (!isRecord(unknownDocument)) throw new ProjectValidationError('Invalid project document');
  if (unknownDocument.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectValidationError('Unsupported project schema version');
  }
  return validateProjectDocumentV1(unknownDocument);
};
