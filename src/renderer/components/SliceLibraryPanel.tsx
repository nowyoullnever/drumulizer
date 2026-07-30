import { formatDuration } from '../audio/time';
import { calculateEffectiveRole } from '../audio/sliceAnalysis/roleScoring';
import type {
  SliceAnalysis,
  SliceAnalysisLifecycle,
  SliceAnalysisResult,
  SliceAnnotationState,
  SliceLibraryFilter,
  SliceLibrarySort,
  SlicePrimaryRole,
  SliceRoleOverride,
} from '../audio/sliceAnalysis/sliceAnalysisTypes';
import { useI18n } from '../i18n/useI18n';
import type { SliceRegion } from '../slice/types';
import { PixelButton } from './PixelButton';

interface SliceLibraryPanelProps {
  slices: SliceRegion[];
  selectedSliceId: string | null;
  lifecycle: SliceAnalysisLifecycle;
  result: SliceAnalysisResult | null;
  progress: number | null;
  filter: SliceLibraryFilter;
  sort: SliceLibrarySort;
  annotations: SliceAnnotationState;
  onAnalyze: () => void;
  onFilterChange: (filter: SliceLibraryFilter) => void;
  onSortChange: (sort: SliceLibrarySort) => void;
  onSelectSlice: (sliceId: string) => void;
  onOverride: (sliceId: string, override: SliceRoleOverride) => void;
  onExclude: (sliceId: string, excluded: boolean) => void;
  onResetSelected: (sliceId: string) => void;
  onResetAll: () => void;
  onIncludeAll: () => void;
}

const roles: SlicePrimaryRole[] = ['low', 'mid', 'high', 'texture', 'unclassified'];
const overrideRoles: SliceRoleOverride[] = ['auto', 'low', 'mid', 'high', 'texture'];
const filters: SliceLibraryFilter[] = [
  'all',
  'included',
  'excluded',
  'low',
  'mid',
  'high',
  'texture',
  'unclassified',
];
const sorts: SliceLibrarySort[] = ['index', 'role', 'confidence', 'duration', 'rms'];

export function SliceLibraryPanel({
  slices,
  selectedSliceId,
  lifecycle,
  result,
  progress,
  filter,
  sort,
  annotations,
  onAnalyze,
  onFilterChange,
  onSortChange,
  onSelectSlice,
  onOverride,
  onExclude,
  onResetSelected,
  onResetAll,
  onIncludeAll,
}: SliceLibraryPanelProps) {
  const { t } = useI18n();
  const analyses = new Map(
    (result?.analyses ?? []).map((analysis) => [analysis.sliceId, analysis]),
  );
  const rows = slices
    .map((slice) => {
      const analysis = analyses.get(slice.id) ?? null;
      const excluded = Boolean(annotations.excluded[slice.id]);
      const effectiveRole = calculateEffectiveRole(
        analysis,
        annotations.overrides[slice.id],
        excluded,
      );
      return { slice, analysis, excluded, effectiveRole };
    })
    .filter((row) => {
      if (filter === 'all') return true;
      if (filter === 'included') return !row.excluded;
      if (filter === 'excluded') return row.excluded;
      return row.effectiveRole === filter;
    })
    .sort((left, right) => compareRows(left, right, sort));
  const selectedAnalysis = selectedSliceId ? (analyses.get(selectedSliceId) ?? null) : null;
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? null;

  return (
    <div className="slice-library">
      <div className={`slice-library__status slice-library__status--${lifecycle}`}>
        <strong>{t('sliceAnalysis.status')}</strong>
        <span>
          {progress !== null && lifecycle === 'analyzing'
            ? `${t(`sliceAnalysis.status.${lifecycle}`)} ${progress}%`
            : t(`sliceAnalysis.status.${lifecycle}`)}
        </span>
        <PixelButton
          onClick={onAnalyze}
          disabled={lifecycle === 'unavailable' || lifecycle === 'analyzing'}
          tone="active"
        >
          {t('sliceAnalysis.analyze')}
        </PixelButton>
      </div>

      <div className="role-distribution" aria-label={t('sliceLibrary.distribution')}>
        {roles.map((role) => (
          <div key={role} className={`role-chip role-chip--${role}`}>
            <span>{t(`sliceRole.${role}`)}</span>
            <strong>{countRole(rows, role)}</strong>
          </div>
        ))}
      </div>

      <div className="slice-library__controls">
        <label>
          {t('sliceLibrary.filter')}
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.currentTarget.value as SliceLibraryFilter)}
          >
            {filters.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`sliceLibrary.filter.${candidate}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('sliceLibrary.sort')}
          <select
            value={sort}
            onChange={(event) => onSortChange(event.currentTarget.value as SliceLibrarySort)}
          >
            {sorts.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`sliceLibrary.sort.${candidate}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="slice-library__grid">
        <div className="slice-library__list" role="listbox" aria-label={t('sliceLibrary.list')}>
          {rows.map(({ slice, analysis, effectiveRole, excluded }) => (
            <button
              key={slice.id}
              type="button"
              className={`slice-library__row slice-library__row--${effectiveRole}${slice.id === selectedSliceId ? ' slice-library__row--selected' : ''}`}
              aria-selected={slice.id === selectedSliceId}
              onClick={() => onSelectSlice(slice.id)}
            >
              <span>{t('slice.number', { number: slice.index + 1 })}</span>
              <strong>{t(`sliceRole.${effectiveRole}`)}</strong>
              <small>
                {analysis
                  ? `${Math.round(analysis.confidence * 100)}%`
                  : t('sliceAnalysis.notReady')}
              </small>
              <small>
                {excluded ? t('sliceLibrary.excluded') : formatDuration(slice.durationSeconds)}
              </small>
            </button>
          ))}
        </div>

        <div className="slice-inspector">
          <strong>{t('sliceLibrary.inspector')}</strong>
          {selectedSlice ? (
            <>
              <dl>
                <div>
                  <dt>{t('slice.duration')}</dt>
                  <dd>{formatDuration(selectedSlice.durationSeconds)}</dd>
                </div>
                <div>
                  <dt>{t('sliceLibrary.autoRole')}</dt>
                  <dd>
                    {selectedAnalysis
                      ? t(`sliceRole.${selectedAnalysis.automaticRole}`)
                      : t('sliceAnalysis.notReady')}
                  </dd>
                </div>
                <div>
                  <dt>{t('analysis.confidence')}</dt>
                  <dd>
                    {selectedAnalysis ? `${Math.round(selectedAnalysis.confidence * 100)}%` : '-'}
                  </dd>
                </div>
                <div>
                  <dt>{t('sliceLibrary.recommendation')}</dt>
                  <dd>
                    {selectedAnalysis
                      ? t(`sliceRecommendation.${selectedAnalysis.generationRecommendation}`)
                      : '-'}
                  </dd>
                </div>
              </dl>

              <div className="role-override" role="group" aria-label={t('sliceLibrary.override')}>
                {overrideRoles.map((role) => (
                  <PixelButton
                    key={role}
                    onClick={() => onOverride(selectedSlice.id, role)}
                    tone={
                      (annotations.overrides[selectedSlice.id] ?? 'auto') === role
                        ? 'active'
                        : 'neutral'
                    }
                    disabled={!selectedAnalysis}
                  >
                    {role === 'auto' ? t('sliceLibrary.auto') : t(`sliceRole.${role}`)}
                  </PixelButton>
                ))}
              </div>

              <div className="slice-library__actions">
                <PixelButton
                  onClick={() =>
                    onExclude(selectedSlice.id, !annotations.excluded[selectedSlice.id])
                  }
                  disabled={!selectedAnalysis}
                >
                  {annotations.excluded[selectedSlice.id]
                    ? t('sliceLibrary.include')
                    : t('sliceLibrary.exclude')}
                </PixelButton>
                <PixelButton
                  onClick={() => onResetSelected(selectedSlice.id)}
                  disabled={!selectedAnalysis}
                >
                  {t('sliceLibrary.resetSelected')}
                </PixelButton>
                <PixelButton onClick={onIncludeAll} disabled={!result}>
                  {t('sliceLibrary.includeAll')}
                </PixelButton>
                <PixelButton onClick={onResetAll} disabled={!result}>
                  {t('sliceLibrary.resetAll')}
                </PixelButton>
              </div>

              {selectedAnalysis ? (
                <FeatureDetails analysis={selectedAnalysis} />
              ) : (
                <p className="empty-module">{t('sliceAnalysis.runPrompt')}</p>
              )}
            </>
          ) : (
            <p className="empty-module">{t('slice.noSelection')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureDetails({ analysis }: { analysis: SliceAnalysis }) {
  const { t } = useI18n();
  const features = [
    ['RMS', `${analysis.features.rmsDb.toFixed(1)} dB`],
    ['Peak', `${analysis.features.peakDb.toFixed(1)} dB`],
    ['Crest', analysis.features.crestFactor.toFixed(2)],
    ['ZCR', analysis.features.zeroCrossingRate.toFixed(3)],
    ['Attack', `${analysis.features.attackMs.toFixed(1)} ms`],
    ['Decay', `${analysis.features.decayMs.toFixed(1)} ms`],
    ['Centroid', `${Math.round(analysis.features.spectralCentroidHz)} Hz`],
    ['Rolloff', `${Math.round(analysis.features.spectralRolloffHz)} Hz`],
    ['Flatness', analysis.features.spectralFlatness.toFixed(2)],
    ['Entropy', analysis.features.spectralEntropy.toFixed(2)],
  ];
  return (
    <div className="feature-details">
      <strong>{t('sliceLibrary.features')}</strong>
      <dl>
        {features.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const countRole = (rows: { effectiveRole: SlicePrimaryRole }[], role: SlicePrimaryRole): number =>
  rows.filter((row) => row.effectiveRole === role).length;

const compareRows = (
  left: { slice: SliceRegion; analysis: SliceAnalysis | null; effectiveRole: SlicePrimaryRole },
  right: { slice: SliceRegion; analysis: SliceAnalysis | null; effectiveRole: SlicePrimaryRole },
  sort: SliceLibrarySort,
): number => {
  if (sort === 'role')
    return (
      left.effectiveRole.localeCompare(right.effectiveRole) || left.slice.index - right.slice.index
    );
  if (sort === 'confidence')
    return (right.analysis?.confidence ?? -1) - (left.analysis?.confidence ?? -1);
  if (sort === 'duration') return right.slice.durationSamples - left.slice.durationSamples;
  if (sort === 'rms')
    return (right.analysis?.features.rmsDb ?? -120) - (left.analysis?.features.rmsDb ?? -120);
  return left.slice.index - right.slice.index;
};
