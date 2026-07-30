import type { AudioImportState, AudioSourceMetadata } from '../audio/types';
import { formatDuration } from '../audio/time';
import { useI18n } from '../i18n/useI18n';
import { PixelButton } from './PixelButton';

interface SourcePanelProps {
  metadata: AudioSourceMetadata | null;
  importState: AudioImportState;
  onOpen: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const statusKey = (state: AudioImportState) => {
  switch (state.status) {
    case 'reading':
      return 'source.status.reading';
    case 'decoding':
      return 'source.status.decoding';
    case 'building-waveform':
      return 'source.status.building';
    case 'ready':
      return 'source.status.ready';
    case 'error':
      return 'source.status.error';
    default:
      return 'source.status.empty';
  }
};

export function SourcePanel({
  metadata,
  importState,
  onOpen,
  onClear,
  disabled,
}: SourcePanelProps) {
  const { t } = useI18n();

  return (
    <div className="source-panel">
      <div className="source-panel__actions">
        <PixelButton onClick={onOpen} disabled={disabled} tone={metadata ? 'neutral' : 'active'}>
          {metadata ? t('source.replace') : t('source.open')}
        </PixelButton>
        <PixelButton onClick={onClear} disabled={!metadata || disabled}>
          {t('source.clear')}
        </PixelButton>
      </div>

      <div className="source-panel__drop-hint">{t('source.dropHint')}</div>

      <div
        className={`source-panel__import-stage source-panel__import-stage--${importState.status}`}
      >
        {t(statusKey(importState))}
      </div>

      {metadata ? (
        <dl className="metadata-grid">
          <div>
            <dt>{t('metadata.file')}</dt>
            <dd>{metadata.fileName}</dd>
          </div>
          <div>
            <dt>{t('metadata.format')}</dt>
            <dd>{metadata.extension.toUpperCase()}</dd>
          </div>
          <div>
            <dt>{t('metadata.size')}</dt>
            <dd>{formatBytes(metadata.fileSizeBytes)}</dd>
          </div>
          <div>
            <dt>{t('metadata.duration')}</dt>
            <dd>{formatDuration(metadata.durationSeconds)}</dd>
          </div>
          <div>
            <dt>{t('metadata.sampleRate')}</dt>
            <dd>{metadata.sampleRate.toLocaleString()} Hz</dd>
          </div>
          <div>
            <dt>{t('metadata.channels')}</dt>
            <dd>
              {metadata.numberOfChannels} / {metadata.channelLabel}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="empty-module pattern pattern--diagonal">
          <strong>{t('source.none')}</strong>
          <span>{t('source.emptyBody')}</span>
        </div>
      )}
    </div>
  );
}
