import { MAX_AUDITION_PREROLL_MS } from '../../shared/constants/slice';
import { formatDuration, formatSeconds } from '../audio/time';
import type { SliceRegion } from '../slice/types';
import { useI18n } from '../i18n/useI18n';
import { PixelButton } from './PixelButton';

interface SelectedSlicePanelProps {
  slice: SliceRegion | null;
  sliceCount: number;
  selectedMarkerId: string | null;
  prerollMs: number;
  hasSource: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onAudition: () => void;
  onStopAudition: () => void;
  onPrerollChange: (ms: number) => void;
  onDeleteMarker: () => void;
}

const prerollPresets = [0, 5, 10, 20, 50];

export function SelectedSlicePanel({
  slice,
  sliceCount,
  selectedMarkerId,
  prerollMs,
  hasSource,
  onPrevious,
  onNext,
  onAudition,
  onStopAudition,
  onPrerollChange,
  onDeleteMarker,
}: SelectedSlicePanelProps) {
  const { t } = useI18n();

  return (
    <div className="selected-slice-panel">
      {slice ? (
        <dl className="selected-slice-panel__metadata">
          <div className="selected-slice-panel__number">
            <dt>{t('panel.selectedSlice')}</dt>
            <dd>{t('slice.number', { number: slice.index + 1 })}</dd>
          </div>
          <div>
            <dt>{t('slice.start')}</dt>
            <dd>{formatSeconds(slice.startSeconds)}</dd>
          </div>
          <div>
            <dt>{t('slice.end')}</dt>
            <dd>{formatSeconds(slice.endSeconds)}</dd>
          </div>
          <div>
            <dt>{t('slice.duration')}</dt>
            <dd>{formatDuration(slice.durationSeconds)}</dd>
          </div>
          <div>
            <dt>{t('slice.startSample')}</dt>
            <dd>{slice.startSample.toLocaleString()}</dd>
          </div>
          <div>
            <dt>{t('slice.endSample')}</dt>
            <dd>{slice.endSample.toLocaleString()}</dd>
          </div>
        </dl>
      ) : (
        <p className="empty-module">{t('slice.noSelection')}</p>
      )}

      <div className="selected-slice-panel__actions">
        <PixelButton onClick={onPrevious} disabled={!slice || slice.index <= 0}>
          {t('slice.previous')}
        </PixelButton>
        <PixelButton onClick={onNext} disabled={!slice || slice.index >= sliceCount - 1}>
          {t('slice.next')}
        </PixelButton>
        <PixelButton onClick={onAudition} disabled={!slice || !hasSource} tone="active">
          {t('slice.audition')}
        </PixelButton>
        <PixelButton onClick={onStopAudition} disabled={!hasSource}>
          {t('slice.stopAudition')}
        </PixelButton>
        <PixelButton onClick={onDeleteMarker} disabled={!selectedMarkerId} tone="danger">
          {t('slice.deleteMarker')}
        </PixelButton>
      </div>

      <div className="preroll-presets" role="group" aria-label={t('slice.preroll')}>
        <strong>{t('slice.preroll')}</strong>
        <div>
          {prerollPresets.map((preset) => (
            <PixelButton
              key={preset}
              onClick={() => onPrerollChange(Math.min(MAX_AUDITION_PREROLL_MS, preset))}
              tone={prerollMs === preset ? 'active' : 'neutral'}
              aria-pressed={prerollMs === preset}
              disabled={!hasSource}
            >
              {t('slice.prerollValue', { ms: preset })}
            </PixelButton>
          ))}
        </div>
      </div>
    </div>
  );
}
