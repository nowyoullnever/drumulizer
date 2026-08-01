import { app } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { MAX_AUDIO_FILE_BYTES } from '../shared/constants/audio';
import type { LocalAudioFileResult, SupportedAudioExtension } from '../shared/types/app';

export interface RegisteredAudioSource {
  token: string;
  displayName: string;
  extension: SupportedAudioExtension;
  mimeType: string;
  byteLength: number;
  sha256: string;
  backingPath: string;
  backingKind: 'linked' | 'temporary' | 'portable-extracted';
  ownsTemporaryFile: boolean;
}

const MIME_BY_EXTENSION: Record<SupportedAudioExtension, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

export const normalizeAudioExtension = (filePath: string): SupportedAudioExtension | null => {
  const extension = extname(filePath).replace('.', '').toLowerCase();
  return extension === 'wav' || extension === 'mp3' ? extension : null;
};

const hashFile = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const hashBytes = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const safeDisplayName = (fileName: string): string =>
  basename(fileName)
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || '<>:"/\\|?*'.includes(character) ? '_' : character;
    })
    .join('');

export class SourceRegistry {
  private active: RegisteredAudioSource | null = null;

  private tempDir(): string {
    return join(app.getPath('temp'), 'drumulizer-sources');
  }

  getActive(): RegisteredAudioSource | null {
    return this.active;
  }

  require(token: string): RegisteredAudioSource {
    if (!this.active || this.active.token !== token) throw new Error('Unknown source token');
    return this.active;
  }

  async clear(): Promise<void> {
    const previous = this.active;
    this.active = null;
    if (previous?.ownsTemporaryFile) {
      await rm(previous.backingPath, { force: true }).catch(() => undefined);
    }
  }

  async cleanup(): Promise<void> {
    await this.clear();
  }

  async registerLinked(filePath: string): Promise<RegisteredAudioSource> {
    const extension = normalizeAudioExtension(filePath);
    if (!extension) throw new Error('UNSUPPORTED_EXTENSION');
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('NOT_A_REGULAR_FILE');
    if (fileStat.size <= 0) throw new Error('EMPTY_FILE');
    if (fileStat.size > MAX_AUDIO_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
    const sha256 = await hashFile(filePath);
    return this.replaceActive({
      token: randomUUID(),
      displayName: basename(filePath),
      extension,
      mimeType: MIME_BY_EXTENSION[extension],
      byteLength: fileStat.size,
      sha256,
      backingPath: filePath,
      backingKind: 'linked',
      ownsTemporaryFile: false,
    });
  }

  async registerTemporaryBytes(
    fileName: string,
    bytes: Uint8Array,
    backingKind: 'temporary' | 'portable-extracted',
  ): Promise<RegisteredAudioSource> {
    const extension = normalizeAudioExtension(fileName);
    if (!extension) throw new Error('UNSUPPORTED_EXTENSION');
    if (bytes.byteLength <= 0) throw new Error('EMPTY_FILE');
    if (bytes.byteLength > MAX_AUDIO_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
    await mkdir(this.tempDir(), { recursive: true });
    const safeName = safeDisplayName(fileName);
    const backingPath = join(this.tempDir(), `${randomUUID()}-${safeName}`);
    await writeFile(backingPath, bytes);
    return this.replaceActive({
      token: randomUUID(),
      displayName: safeName,
      extension,
      mimeType: MIME_BY_EXTENSION[extension],
      byteLength: bytes.byteLength,
      sha256: hashBytes(bytes),
      backingPath,
      backingKind,
      ownsTemporaryFile: true,
    });
  }

  async readSourceBytes(source: RegisteredAudioSource): Promise<Buffer> {
    return readFile(source.backingPath);
  }

  async copyToTemporary(source: RegisteredAudioSource): Promise<string> {
    await mkdir(this.tempDir(), { recursive: true });
    const target = join(this.tempDir(), `${randomUUID()}-${source.displayName}`);
    await copyFile(source.backingPath, target);
    return target;
  }

  async toImportResult(source: RegisteredAudioSource): Promise<LocalAudioFileResult> {
    const bytes = await this.readSourceBytes(source);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return {
      canceled: false,
      sourceToken: source.token,
      sourceKind:
        source.backingKind === 'linked'
          ? 'linked'
          : source.backingKind === 'temporary'
            ? 'temporary'
            : 'portable',
      fileName: source.displayName,
      extension: source.extension,
      mimeType: source.mimeType,
      fileSizeBytes: source.byteLength,
      sha256: source.sha256,
      bytes: arrayBuffer,
    };
  }

  private async replaceActive(source: RegisteredAudioSource): Promise<RegisteredAudioSource> {
    await this.clear();
    this.active = source;
    return source;
  }
}
