import type {
  OnsetAnalysisReason,
  OnsetApplyMode,
  OnsetApplySummary,
  OnsetCandidate,
  OnsetDetectionSettings,
} from '../audio/onset/onsetTypes';
import { MAX_ONSET_GAP_MS, MIN_ONSET_GAP_MS } from '../audio/onset/onsetTypes';
import { useI18n } from '../i18n/useI18n';
import { PixelButton } from './PixelButton';
import { PixelNumberInput } from './PixelNumberInput';
import { PixelSlider } from './PixelSlider';

interface AnalysisPanelProps {
  hasSource: boolean;
  settings: OnsetDetectionSettings;
  analyzing: boolean;
  progress: number | null;
  candidates: OnsetCandidate[];
  applyMode: OnsetApplyMode;
  resultReason: OnsetAnalysisReason | null;
  applySummary: OnsetApplySummary | null;
  onSettingsChange: (settings: OnsetDetectionSettings) => void;
  onAnalyze: () => void;
  onApplyModeChange: (mode: OnsetApplyMode) => void;
  onApply: () => void;
  onDiscard: () => void;
}

export function AnalysisPanel({
  hasSource,
  settings,
  analyzing,
  progress,
  candidates,
  applyMode,
  resultReason,
  applySummary,
  onSettingsChange,
  onAnalyze,
  onApplyModeChange,
  onApply,
  onDiscard,
}: AnalysisPanelProps) {
  const { t } = useI18n();
  const statusText = analyzing
    ? progress === null
      ? t('analysis.analyzing')
      : `${t('analysis.analyzing')} ${progress}%`
    : resultReason === 'SILENT_SOURCE'
      ? t('analysis.silentSource')
      : candidates.length === 0
        ? t('analysis.noOnsetsFound')
        : t('analysis.complete');

  return (
    <div className="analysis-panel">
      <PixelSlider
        label={t('analysis.sensitivity')}
        min={0}
        max={100}
        step={1}
        value={settings.sensitivity}
        disabled={!hasSource || analyzing}
        onChange={(event) =>
          onSettingsChange({ ...settings, sensitivity: Number(event.currentTarget.value) })
        }
      />
      <PixelNumberInput
        label={t('analysis.minimumGap')}
        min={MIN_ONSET_GAP_MS}
        max={MAX_ONSET_GAP_MS}
        step={1}
        value={settings.minimumGapMs}
        disabled={!hasSource || analyzing}
        onChange={(event) =>
          onSettingsChange({ ...settings, minimumGapMs: Number(event.currentTarget.value) })
        }
      />
      <PixelButton onClick={onAnalyze} disabled={!hasSource || analyzing} tone="active">
        {analyzing ? t('analysis.analyzing') : t('analysis.analyze')}
      </PixelButton>

      <dl className="analysis-panel__stats">
        <div>
          <dt>{t('analysis.candidates')}</dt>
          <dd>{candidates.length}</dd>
        </div>
        <div>
          <dt>{t('analysis.result')}</dt>
          <dd>{statusText}</dd>
        </div>
      </dl>

      <div className="analysis-panel__mode" role="group" aria-label={t('analysis.applyMode')}>
        <strong>{t('analysis.applyMode')}</strong>
        <PixelButton
          onClick={() => onApplyModeChange('replace')}
          tone={applyMode === 'replace' ? 'active' : 'neutral'}
          aria-pressed={applyMode === 'replace'}
          disabled={analyzing}
        >
          {t('analysis.applyMode.replace')}
        </PixelButton>
        <PixelButton
          onClick={() => onApplyModeChange('merge')}
          tone={applyMode === 'merge' ? 'active' : 'neutral'}
          aria-pressed={applyMode === 'merge'}
          disabled={analyzing}
        >
          {t('analysis.applyMode.merge')}
        </PixelButton>
      </div>

      <div className="analysis-panel__actions">
        <PixelButton onClick={onApply} disabled={candidates.length === 0 || analyzing}>
          {t('analysis.apply')}
        </PixelButton>
        <PixelButton onClick={onDiscard} disabled={candidates.length === 0 || analyzing}>
          {t('analysis.discard')}
        </PixelButton>
      </div>

      {applySummary ? (
        <p className="analysis-panel__message">
          {t('analysis.appliedMarkers', { count: applySummary.markersApplied })}{' '}
          {t('analysis.skippedCandidates', { count: applySummary.candidatesSkipped })}
        </p>
      ) : null}
      {resultReason === 'CANDIDATE_LIMIT_REACHED' ? (
        <p className="analysis-panel__message">{t('analysis.candidateLimitReached')}</p>
      ) : null}
    </div>
  );
}
