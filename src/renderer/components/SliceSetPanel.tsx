import { MAX_SLICE_MARKERS } from '../../shared/constants/slice';
import { PixelButton } from './PixelButton';
import { PixelNumberInput } from './PixelNumberInput';
import { PixelToggle } from './PixelToggle';
import type { SliceEditErrorCode, WaveformTool } from '../slice/types';
import { useI18n } from '../i18n/useI18n';

interface SliceSetPanelProps {
  markerCount: number;
  sliceCount: number;
  tool: WaveformTool;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  zeroCrossingEnabled: boolean;
  customDivision: number;
  inlineError: SliceEditErrorCode | null;
  inlineMessage: string | null;
  onToolChange: (tool: WaveformTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onZeroCrossingChange: (enabled: boolean) => void;
  onEqualDivide: (count: number) => void;
  onCustomDivisionChange: (count: number) => void;
}

const divisionPresets = [4, 8, 16, 32];

export function SliceSetPanel({
  markerCount,
  sliceCount,
  tool,
  canEdit,
  canUndo,
  canRedo,
  canReset,
  zeroCrossingEnabled,
  customDivision,
  inlineError,
  inlineMessage,
  onToolChange,
  onUndo,
  onRedo,
  onReset,
  onZeroCrossingChange,
  onEqualDivide,
  onCustomDivisionChange,
}: SliceSetPanelProps) {
  const { t } = useI18n();
  const markerLimitReached = markerCount >= MAX_SLICE_MARKERS;

  return (
    <div className="slice-set-panel">
      <dl className="slice-stats">
        <div>
          <dt>{t('slice.markerCount')}</dt>
          <dd>
            {markerCount} / {MAX_SLICE_MARKERS}
          </dd>
        </div>
        <div>
          <dt>{t('slice.sliceCount')}</dt>
          <dd>{sliceCount}</dd>
        </div>
        <div>
          <dt>{t('slice.tool')}</dt>
          <dd>{t(tool === 'select' ? 'slice.tool.select' : 'slice.tool.addMarker')}</dd>
        </div>
      </dl>

      <div className="tool-switch" role="group" aria-label={t('slice.tool')}>
        <PixelButton
          onClick={() => onToolChange('select')}
          tone={tool === 'select' ? 'active' : 'neutral'}
          aria-pressed={tool === 'select'}
          title={t('slice.tool.selectTip')}
          disabled={!canEdit}
        >
          [] {t('slice.tool.select')}
        </PixelButton>
        <PixelButton
          onClick={() => onToolChange('add-marker')}
          tone={tool === 'add-marker' ? 'active' : 'neutral'}
          aria-pressed={tool === 'add-marker'}
          title={t('slice.tool.addMarkerTip')}
          disabled={!canEdit || markerLimitReached}
        >
          + {t('slice.tool.addMarker')}
        </PixelButton>
      </div>

      <div className="slice-history-controls">
        <PixelButton onClick={onUndo} disabled={!canUndo}>
          {t('slice.undo')}
        </PixelButton>
        <PixelButton onClick={onRedo} disabled={!canRedo}>
          {t('slice.redo')}
        </PixelButton>
        <PixelButton onClick={onReset} disabled={!canReset}>
          {t('slice.reset')}
        </PixelButton>
      </div>

      <PixelToggle
        label={t('slice.zeroCrossing')}
        checked={zeroCrossingEnabled}
        onChange={(event) => onZeroCrossingChange(event.currentTarget.checked)}
        disabled={!canEdit}
      />

      <div className="equal-division">
        <strong>{t('slice.equalDivide')}</strong>
        <div className="equal-division__presets">
          {divisionPresets.map((count) => (
            <PixelButton key={count} onClick={() => onEqualDivide(count)} disabled={!canEdit}>
              {count}
            </PixelButton>
          ))}
        </div>
        <div className="equal-division__custom">
          <PixelNumberInput
            label={t('slice.customDivision')}
            min={2}
            max={128}
            step={1}
            value={customDivision}
            onChange={(event) => onCustomDivisionChange(Number(event.currentTarget.value))}
            disabled={!canEdit}
          />
          <PixelButton onClick={() => onEqualDivide(customDivision)} disabled={!canEdit}>
            {t('slice.applyCustomDivision')}
          </PixelButton>
        </div>
      </div>

      <p
        className={
          inlineError ? 'slice-inline-message slice-inline-message--error' : 'slice-inline-message'
        }
      >
        {inlineError ? t(`slice.error.${inlineError}`) : (inlineMessage ?? t('slice.inlineReady'))}
      </p>
      <p className="slice-shortcuts">{t('slice.shortcutHelp')}</p>
    </div>
  );
}
