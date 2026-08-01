export const MAX_AUDIO_FILE_BYTES = 250 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 30 * 60;

export const SUPPORTED_AUDIO_EXTENSIONS = ['wav', 'mp3'] as const;

export const AUDIO_IMPORT_CHANNEL = 'drumulizer:select-local-audio-file';
export const AUDIO_REGISTER_BYTES_CHANNEL = 'drumulizer:register-audio-bytes';
