export interface DrumulizerAppInfo {
  name: string;
  version: string;
  platform: string;
}

export type AppStatus = 'ready' | 'processing' | 'error';

export type SupportedAudioExtension = 'wav' | 'mp3';

export type LocalAudioFileErrorCode =
  'UNSUPPORTED_EXTENSION' | 'NOT_A_REGULAR_FILE' | 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'READ_FAILED';

export interface LocalAudioFileResult {
  canceled: boolean;
  sourceToken?: string;
  sourceKind?: 'linked' | 'temporary' | 'portable';
  fileName?: string;
  extension?: SupportedAudioExtension;
  mimeType?: string;
  fileSizeBytes?: number;
  sha256?: string;
  bytes?: ArrayBuffer;
  errorCode?: LocalAudioFileErrorCode;
}

export type ProjectFileKind = 'linked' | 'portable';
export type ProjectDialogResult<T> = { canceled: true } | ({ canceled: false } & T);

export interface ProjectSessionInfo {
  sessionId: string;
  projectId: string;
  projectName: string;
  kind: ProjectFileKind;
  displayPath: string;
  lastSavedAt: string;
}

export interface ProjectOpenResult {
  session: ProjectSessionInfo;
  source: LocalAudioFileResult;
  projectState: unknown;
  warningCode?: string;
}

export interface SaveProjectRequest {
  sourceToken: string;
  projectState: unknown;
  existingProjectSessionId: string | null;
}

export interface SaveProjectResult {
  session: ProjectSessionInfo;
}

export type ExportAudioFile = {
  fileName: string;
  bytes: ArrayBuffer;
};

export interface WriteExportFilesRequest {
  files: ExportAudioFile[];
}

export interface WriteExportFilesResult {
  directoryName: string;
  writtenCount: number;
  files: string[];
}

export interface DrumulizerApi {
  getAppInfo: () => DrumulizerAppInfo;
  selectLocalAudioFile: () => Promise<LocalAudioFileResult>;
  registerAudioBytes: (request: {
    fileName: string;
    bytes: ArrayBuffer;
  }) => Promise<LocalAudioFileResult>;
  openProject: () => Promise<ProjectDialogResult<ProjectOpenResult>>;
  saveProject: (request: SaveProjectRequest) => Promise<ProjectDialogResult<SaveProjectResult>>;
  saveLinkedProjectAs: (
    request: SaveProjectRequest,
  ) => Promise<ProjectDialogResult<SaveProjectResult>>;
  savePortableProjectAs: (
    request: SaveProjectRequest,
  ) => Promise<ProjectDialogResult<SaveProjectResult>>;
  relinkMissingSource: (
    sourceDescriptor: unknown,
  ) => Promise<ProjectDialogResult<LocalAudioFileResult>>;
  chooseExportDirectoryAndWrite: (
    request: WriteExportFilesRequest,
  ) => Promise<ProjectDialogResult<WriteExportFilesResult>>;
}
