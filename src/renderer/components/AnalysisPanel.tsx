import type {
  OnsetAnalysisReason,
  OnsetAnalysisDiagnostics,
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
  selectedCandidateId: string | null;
  diagnostics: OnsetAnalysisDiagnostics | null;
  applyMode: OnsetApplyMode;
  resultReason: OnsetAnalysisReason | null;
  applySummary: OnsetApplySummary | null;
  onSettingsChange: (settings: OnsetDetectionSettings) => void;
  onAnalyze: () => void;
  onApplyModeChange: (mode: OnsetApplyMode) => void;
  onPreviousCandidate: () => void;
  onNextCandidate: () => void;
  onAuditionCandidate: () => void;
  onStopCandidateAudition: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

export function AnalysisPanel({
  hasSource,
  settings,
  analyzing,
  progress,
  candidates,
  selectedCandidateId,
  diagnostics,
  applyMode,
  resultReason,
  applySummary,
  onSettingsChange,
  onAnalyze,
  onApplyModeChange,
  onPreviousCandidate,
  onNextCandidate,
  onAuditionCandidate,
  onStopCandidateAudition,
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
  const selectedIndex = candidates.findIndex((candidate) => candidate.id === selectedCandidateId);
  const selectedCandidate = selectedIndex >= 0 ? candidates[selectedIndex] : null;

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
        <div>
          <dt>{t('analysis.candidateDensity')}</dt>
          <dd>{diagnostics ? diagnostics.candidateDensityPerSecond.toFixed(1) : '0.0'}</dd>
        </div>
        <div>
          <dt>{t('analysis.strongestBand')}</dt>
          <dd>
            {diagnostics?.strongestBand
              ? t(`analysis.band.${diagnostics.strongestBand}`)
              : t('analysis.none')}
          </dd>
        </div>
      </dl>

      <div className="candidate-details">
        <strong>{t('analysis.candidateDetails')}</strong>
        {selectedCandidate ? (
          <dl>
            <div>
              <dt>{t('analysis.candidateNumber')}</dt>
              <dd>
                {selectedIndex + 1} / {candidates.length}
              </dd>
            </div>
            <div>
              <dt>{t('slice.start')}</dt>
              <dd>{selectedCandidate.timeSeconds.toFixed(3)}s</dd>
            </div>
            <div>
              <dt>{t('analysis.confidence')}</dt>
              <dd>{Math.round(selectedCandidate.confidence * 100)}%</dd>
            </div>
            <div>
              <dt>{t('analysis.dominantBand')}</dt>
              <dd>{t(`analysis.band.${selectedCandidate.dominantBand}`)}</dd>
            </div>
            <div>
              <dt>{t('analysis.supportingFeatures')}</dt>
              <dd>{selectedCandidate.supportCount}</dd>
            </div>
          </dl>
        ) : (
          <p>{t('analysis.selectPreviewMarker')}</p>
        )}
      </div>

      <div className="analysis-panel__actions">
        <PixelButton onClick={onPreviousCandidate} disabled={selectedIndex <= 0 || analyzing}>
          {t('analysis.previousCandidate')}
        </PixelButton>
        <PixelButton
          onClick={onNextCandidate}
          disabled={selectedIndex < 0 || selectedIndex >= candidates.length - 1 || analyzing}
        >
          {t('analysis.nextCandidate')}
        </PixelButton>
        <PixelButton onClick={onAuditionCandidate} disabled={!selectedCandidate || analyzing}>
          {t('analysis.auditionCandidate')}
        </PixelButton>
        <PixelButton onClick={onStopCandidateAudition} disabled={!hasSource}>
          {t('analysis.stopCandidateAudition')}
        </PixelButton>
      </div>

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
      {diagnostics?.denseSuppressionApplied ? (
        <p className="analysis-panel__message">{t('analysis.denseAdjusted')}</p>
      ) : null}
    </div>
  );
}
