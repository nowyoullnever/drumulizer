import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { APP_VERSION } from '../shared/version';
import {
  EXPORT_WRITE_FILES_CHANNEL,
  LINKED_PROJECT_EXTENSION,
  PORTABLE_PROJECT_EXTENSION,
  PROJECT_OPEN_CHANNEL,
  PROJECT_SAVE_CHANNEL,
  PROJECT_SAVE_LINKED_AS_CHANNEL,
  PROJECT_SAVE_PORTABLE_AS_CHANNEL,
  PROJECT_RELINK_SOURCE_CHANNEL,
} from '../shared/constants/project';
import { encodePortableProject, decodePortableProject } from '../shared/project/portable';
import {
  migrateProjectDocument,
  validateProjectSourceDescriptor,
  type DrumulizerProjectDocumentV1,
  type ProjectSourceDescriptor,
} from '../shared/project/schema';
import type {
  ProjectDialogResult,
  ProjectOpenResult,
  ProjectSessionInfo,
  SaveProjectRequest,
  SaveProjectResult,
  WriteExportFilesRequest,
  WriteExportFilesResult,
} from '../shared/types/app';
import { normalizeAudioExtension, type SourceRegistry } from './sourceRegistry';

interface ProjectSessionInternal extends ProjectSessionInfo {
  backingPath: string;
  createdAt: string;
}

const sessions = new Map<string, ProjectSessionInternal>();

const nowIso = (): string => new Date().toISOString();

const ensureExtension = (filePath: string, extension: string): string =>
  extname(filePath).toLowerCase() === `.${extension}` ? filePath : `${filePath}.${extension}`;

const atomicWrite = async (filePath: string, bytes: Uint8Array | string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, bytes);
  await rename(temp, filePath);
};

const safeSession = (session: ProjectSessionInternal): ProjectSessionInfo => ({
  sessionId: session.sessionId,
  projectId: session.projectId,
  projectName: session.projectName,
  kind: session.kind,
  displayPath: basename(session.displayPath),
  lastSavedAt: session.lastSavedAt,
});

const decodedFromState = (projectState: unknown): ProjectSourceDescriptor['decoded'] => {
  const state = projectState as { source?: { decoded?: ProjectSourceDescriptor['decoded'] } };
  const decoded = state.source?.decoded;
  if (!decoded) throw new Error('Missing decoded source state');
  return decoded;
};

const projectNameFromPath = (filePath: string): string => basename(filePath, extname(filePath));

const buildDocument = (
  request: SaveProjectRequest,
  source: ReturnType<SourceRegistry['require']>,
  filePath: string,
  kind: 'linked' | 'portable',
  previous: ProjectSessionInternal | null,
): DrumulizerProjectDocumentV1 => {
  const now = nowIso();
  const projectId = previous?.projectId ?? randomUUID();
  const projectName = previous?.projectName ?? projectNameFromPath(filePath);
  const reference =
    kind === 'linked'
      ? {
          kind: 'linked' as const,
          absolutePath: source.backingPath,
          relativePath: relative(dirname(filePath), source.backingPath) || null,
        }
      : { kind: 'embedded' as const, audioByteLength: source.byteLength };
  return migrateProjectDocument({
    format: 'drumulizer-project',
    schemaVersion: 1,
    appVersion: APP_VERSION,
    projectId,
    projectName,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    source: {
      logicalSourceId: source.token,
      fileName: source.displayName,
      extension: source.extension,
      mimeType: source.mimeType,
      byteLength: source.byteLength,
      sha256: source.sha256,
      decoded: decodedFromState(request.projectState),
      reference,
    },
    editor: (request.projectState as { editor?: unknown }).editor,
    sliceAnalysis: (request.projectState as { sliceAnalysis?: unknown }).sliceAnalysis ?? null,
    sequencer: (request.projectState as { sequencer?: unknown }).sequencer,
  });
};

const saveSession = (
  filePath: string,
  kind: 'linked' | 'portable',
  document: DrumulizerProjectDocumentV1,
): ProjectSessionInfo => {
  const session: ProjectSessionInternal = {
    sessionId: randomUUID(),
    projectId: document.projectId,
    projectName: document.projectName,
    kind,
    displayPath: filePath,
    backingPath: filePath,
    createdAt: document.createdAt,
    lastSavedAt: document.updatedAt,
  };
  sessions.set(session.sessionId, session);
  return safeSession(session);
};

const resolveSourcePath = async (
  projectPath: string,
  source: ProjectSourceDescriptor,
): Promise<string | null> => {
  if (source.reference.kind !== 'linked') return null;
  const candidates = [
    source.reference.relativePath
      ? resolve(dirname(projectPath), source.reference.relativePath)
      : null,
    source.reference.absolutePath,
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile() && fileStat.size === source.byteLength) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
};

const writeExportFiles = async (
  window: BrowserWindow,
  request: WriteExportFilesRequest,
): Promise<ProjectDialogResult<WriteExportFilesResult>> => {
  if (!Array.isArray(request.files) || request.files.length === 0 || request.files.length > 64) {
    throw new Error('Invalid export files');
  }
  const result = await dialog.showOpenDialog(window, {
    title: 'Choose Export Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const directory = result.filePaths[0];
  const files: string[] = [];
  for (const file of request.files) {
    const safeName = basename(file.fileName);
    if (safeName !== file.fileName || !safeName.toLowerCase().endsWith('.wav')) {
      throw new Error('Invalid export file name');
    }
    const bytes = Buffer.from(file.bytes);
    const target = resolve(directory, safeName);
    await atomicWrite(target, bytes);
    files.push(safeName);
  }
  return { canceled: false, directoryName: basename(directory), writtenCount: files.length, files };
};

const rendererProjectState = (
  document: DrumulizerProjectDocumentV1,
  sourceToken: string,
): unknown => ({
  source: { token: sourceToken, decoded: document.source.decoded },
  editor: document.editor,
  sliceAnalysis: document.sliceAnalysis,
  sequencer: document.sequencer,
});

export const registerProjectHandlers = (window: BrowserWindow, registry: SourceRegistry): void => {
  ipcMain.handle(
    PROJECT_SAVE_LINKED_AS_CHANNEL,
    async (
      _event,
      request: SaveProjectRequest,
    ): Promise<ProjectDialogResult<SaveProjectResult>> => {
      const source = registry.require(request.sourceToken);
      if (source.backingKind !== 'linked') throw new Error('Linked save requires linked source');
      const result = await dialog.showSaveDialog(window, {
        title: 'Save Linked Project',
        defaultPath: `Untitled.${LINKED_PROJECT_EXTENSION}`,
        filters: [{ name: 'Drumulizer Linked Project', extensions: [LINKED_PROJECT_EXTENSION] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      const filePath = ensureExtension(result.filePath, LINKED_PROJECT_EXTENSION);
      if (resolve(filePath) === resolve(source.backingPath)) {
        throw new Error('Project cannot overwrite source audio');
      }
      const previous = request.existingProjectSessionId
        ? (sessions.get(request.existingProjectSessionId) ?? null)
        : null;
      const document = buildDocument(request, source, filePath, 'linked', previous);
      await atomicWrite(filePath, JSON.stringify(document, null, 2));
      return { canceled: false, session: saveSession(filePath, 'linked', document) };
    },
  );

  ipcMain.handle(
    PROJECT_SAVE_PORTABLE_AS_CHANNEL,
    async (
      _event,
      request: SaveProjectRequest,
    ): Promise<ProjectDialogResult<SaveProjectResult>> => {
      const source = registry.require(request.sourceToken);
      const result = await dialog.showSaveDialog(window, {
        title: 'Save Portable Project',
        defaultPath: `Untitled.${PORTABLE_PROJECT_EXTENSION}`,
        filters: [
          { name: 'Drumulizer Portable Project', extensions: [PORTABLE_PROJECT_EXTENSION] },
        ],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      const filePath = ensureExtension(result.filePath, PORTABLE_PROJECT_EXTENSION);
      const previous = request.existingProjectSessionId
        ? (sessions.get(request.existingProjectSessionId) ?? null)
        : null;
      const document = buildDocument(request, source, filePath, 'portable', previous);
      const audioBytes = await registry.readSourceBytes(source);
      const portable = encodePortableProject(document, audioBytes);
      await atomicWrite(filePath, portable);
      return { canceled: false, session: saveSession(filePath, 'portable', document) };
    },
  );

  ipcMain.handle(
    PROJECT_SAVE_CHANNEL,
    async (
      _event,
      request: SaveProjectRequest,
    ): Promise<ProjectDialogResult<SaveProjectResult>> => {
      const existing = request.existingProjectSessionId
        ? sessions.get(request.existingProjectSessionId)
        : null;
      if (!existing) {
        throw new Error('Save Project requires an existing project session');
      }
      const source = registry.require(request.sourceToken);
      const document = buildDocument(
        request,
        source,
        existing.backingPath,
        existing.kind,
        existing,
      );
      if (existing.kind === 'linked') {
        if (source.backingKind !== 'linked') throw new Error('Linked save requires linked source');
        await atomicWrite(existing.backingPath, JSON.stringify(document, null, 2));
      } else {
        const audioBytes = await registry.readSourceBytes(source);
        await atomicWrite(existing.backingPath, encodePortableProject(document, audioBytes));
      }
      return {
        canceled: false,
        session: saveSession(existing.backingPath, existing.kind, document),
      };
    },
  );

  ipcMain.handle(
    PROJECT_OPEN_CHANNEL,
    async (): Promise<ProjectDialogResult<ProjectOpenResult>> => {
      const result = await dialog.showOpenDialog(window, {
        title: 'Open Project',
        properties: ['openFile'],
        filters: [
          {
            name: 'Drumulizer Projects',
            extensions: [LINKED_PROJECT_EXTENSION, PORTABLE_PROJECT_EXTENSION],
          },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      const projectPath = result.filePaths[0];
      const extension = extname(projectPath).replace('.', '').toLowerCase();
      let document: DrumulizerProjectDocumentV1;
      if (extension === LINKED_PROJECT_EXTENSION) {
        document = migrateProjectDocument(JSON.parse(await readFile(projectPath, 'utf8')));
        const sourcePath = await resolveSourcePath(projectPath, document.source);
        if (!sourcePath) throw new Error('MISSING_SOURCE');
        const source = await registry.registerLinked(sourcePath);
        if (source.sha256 !== document.source.sha256) throw new Error('SOURCE_HASH_MISMATCH');
        return {
          canceled: false,
          session: saveSession(projectPath, 'linked', document),
          source: await registry.toImportResult(source),
          projectState: rendererProjectState(document, source.token),
        };
      }
      if (extension === PORTABLE_PROJECT_EXTENSION) {
        const decoded = decodePortableProject(await readFile(projectPath));
        document = decoded.manifest;
        if (document.source.reference.kind !== 'embedded')
          throw new Error('Invalid portable source');
        const source = await registry.registerTemporaryBytes(
          document.source.fileName,
          decoded.audioBytes,
          'portable-extracted',
        );
        if (source.sha256 !== document.source.sha256) throw new Error('SOURCE_HASH_MISMATCH');
        return {
          canceled: false,
          session: saveSession(projectPath, 'portable', document),
          source: await registry.toImportResult(source),
          projectState: rendererProjectState(document, source.token),
        };
      }
      throw new Error('Unsupported project extension');
    },
  );

  ipcMain.handle(
    PROJECT_RELINK_SOURCE_CHANNEL,
    async (
      _event,
      sourceDescriptor: unknown,
    ): Promise<ProjectDialogResult<Awaited<ReturnType<SourceRegistry['toImportResult']>>>> => {
      const source = validateProjectSourceDescriptor(sourceDescriptor);
      const result = await dialog.showOpenDialog(window, {
        title: 'Relink Source Audio',
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: [source.extension] }],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      const extension = normalizeAudioExtension(result.filePaths[0]);
      if (extension !== source.extension) throw new Error('SOURCE_EXTENSION_MISMATCH');
      const registered = await registry.registerLinked(result.filePaths[0]);
      if (registered.sha256 !== source.sha256) throw new Error('SOURCE_HASH_MISMATCH');
      return registry.toImportResult(registered);
    },
  );

  ipcMain.handle(EXPORT_WRITE_FILES_CHANNEL, (_event, request: WriteExportFilesRequest) =>
    writeExportFiles(window, request),
  );
};
