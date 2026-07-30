import type { AudioImportState, AudioSourceMetadata } from '../audio/types';
import { formatDuration } from '../audio/time';
import { PixelButton } from './PixelButton';
import { StatusBadge } from './StatusBadge';

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

const statusLabel = (state: AudioImportState): string => {
  switch (state.status) {
    case 'reading':
      return '파일 읽는 중';
    case 'decoding':
      return '오디오 해석 중';
    case 'building-waveform':
      return '파형 만드는 중';
    case 'ready':
      return '준비 완료';
    case 'error':
      return '불러오기 실패';
    default:
      return '소스 없음';
  }
};

export function SourcePanel({
  metadata,
  importState,
  onOpen,
  onClear,
  disabled,
}: SourcePanelProps) {
  return (
    <div className="source-panel">
      <div className="source-panel__actions">
        <PixelButton onClick={onOpen} disabled={disabled} tone={metadata ? 'neutral' : 'active'}>
          {metadata ? '파일 바꾸기' : '파일 열기'}
        </PixelButton>
        <PixelButton onClick={onClear} disabled={!metadata || disabled}>
          소스 비우기
        </PixelButton>
      </div>

      <div className="source-panel__drop-hint">
        WAV 또는 MP3 하나를 여기나 파형 영역에 놓으세요.
      </div>

      <StatusBadge
        status={importState.status === 'error' ? 'error' : metadata ? 'ready' : 'disabled'}
        label={statusLabel(importState)}
      />

      {metadata ? (
        <dl className="metadata-grid">
          <div>
            <dt>파일</dt>
            <dd>{metadata.fileName}</dd>
          </div>
          <div>
            <dt>형식</dt>
            <dd>{metadata.extension.toUpperCase()}</dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>{formatBytes(metadata.fileSizeBytes)}</dd>
          </div>
          <div>
            <dt>길이</dt>
            <dd>{formatDuration(metadata.durationSeconds)}</dd>
          </div>
          <div>
            <dt>샘플레이트</dt>
            <dd>{metadata.sampleRate.toLocaleString()} Hz</dd>
          </div>
          <div>
            <dt>채널</dt>
            <dd>
              {metadata.numberOfChannels} / {metadata.channelLabel}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="empty-module pattern pattern--diagonal">
          <strong>소스 없음</strong>
          <span>로컬 오디오만 불러옵니다. 전체 파일 경로는 표시하지 않습니다.</span>
        </div>
      )}
    </div>
  );
}
