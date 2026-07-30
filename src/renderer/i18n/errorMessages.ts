import type { LocalAudioFileErrorCode } from '../../shared/types/app';
import type { AudioImportErrorCode } from '../audio/importAudio';
import type { TranslationKey } from './translations';

export type UserFacingErrorCode =
  LocalAudioFileErrorCode | AudioImportErrorCode | 'MULTIPLE_FILES' | 'UNKNOWN_IMPORT';

export const errorKeyForCode = (code: UserFacingErrorCode): TranslationKey => `errors.${code}`;
