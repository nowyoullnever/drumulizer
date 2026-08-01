import { MAX_AUDIO_FILE_BYTES } from '../constants/audio';
import { MAX_PROJECT_MANIFEST_BYTES, PORTABLE_PROJECT_MAGIC } from '../constants/project';
import { migrateProjectDocument, type DrumulizerProjectDocumentV1 } from './schema';

export class PortableProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortableProjectError';
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const uint64ToNumber = (view: DataView, offset: number): number => {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PortableProjectError('Portable project length is too large');
  }
  return Number(value);
};

export const encodePortableProject = (
  manifest: DrumulizerProjectDocumentV1,
  audioBytes: Uint8Array,
): Uint8Array => {
  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_PROJECT_MANIFEST_BYTES) {
    throw new PortableProjectError('Portable manifest is too large');
  }
  if (audioBytes.byteLength <= 0 || audioBytes.byteLength > MAX_AUDIO_FILE_BYTES) {
    throw new PortableProjectError('Portable audio length is invalid');
  }
  const output = new Uint8Array(8 + 4 + 8 + manifestBytes.byteLength + audioBytes.byteLength);
  output.set(encoder.encode(PORTABLE_PROJECT_MAGIC), 0);
  const view = new DataView(output.buffer);
  view.setUint32(8, manifestBytes.byteLength, true);
  view.setBigUint64(12, BigInt(audioBytes.byteLength), true);
  output.set(manifestBytes, 20);
  output.set(audioBytes, 20 + manifestBytes.byteLength);
  return output;
};

export const decodePortableProject = (
  bytes: Uint8Array,
): { manifest: DrumulizerProjectDocumentV1; audioBytes: Uint8Array } => {
  if (bytes.byteLength < 20) throw new PortableProjectError('Truncated portable header');
  const magic = decoder.decode(bytes.slice(0, 8));
  if (magic !== PORTABLE_PROJECT_MAGIC) throw new PortableProjectError('Invalid portable magic');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const manifestLength = view.getUint32(8, true);
  const audioLength = uint64ToNumber(view, 12);
  if (manifestLength <= 0 || manifestLength > MAX_PROJECT_MANIFEST_BYTES) {
    throw new PortableProjectError('Invalid portable manifest length');
  }
  if (audioLength <= 0 || audioLength > MAX_AUDIO_FILE_BYTES) {
    throw new PortableProjectError('Invalid portable audio length');
  }
  const expected = 20 + manifestLength + audioLength;
  if (expected !== bytes.byteLength)
    throw new PortableProjectError('Portable project is truncated');
  const manifestJson = decoder.decode(bytes.slice(20, 20 + manifestLength));
  const manifest = migrateProjectDocument(JSON.parse(manifestJson));
  return {
    manifest,
    audioBytes: bytes.slice(20 + manifestLength),
  };
};
