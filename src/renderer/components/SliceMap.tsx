import { formatDuration } from '../audio/time';
import type { SliceRegion } from '../slice/types';
import { useI18n } from '../i18n/useI18n';

interface SliceMapProps {
  slices: SliceRegion[];
  selectedSliceId: string | null;
  onSelectSlice: (sliceId: string) => void;
}

export function SliceMap({ slices, selectedSliceId, onSelectSlice }: SliceMapProps) {
  const { t } = useI18n();
  const totalSamples = slices.reduce((sum, slice) => sum + slice.durationSamples, 0);
  const compact = slices.length > 32;

  return (
    <div className="slice-map" aria-label={t('slice.mapLabel')}>
      {slices.map((slice) => {
        const selected = slice.id === selectedSliceId;
        const basis = totalSamples > 0 ? (slice.durationSamples / totalSamples) * 100 : 100;
        return (
          <button
            key={slice.id}
            className={
              selected ? 'slice-map__block slice-map__block--selected' : 'slice-map__block'
            }
            style={{ flexBasis: `${Math.max(3, basis)}%` }}
            type="button"
            aria-pressed={selected}
            aria-label={t('slice.mapBlockLabel', {
              number: slice.index + 1,
              duration: formatDuration(slice.durationSeconds),
            })}
            onClick={() => onSelectSlice(slice.id)}
          >
            {compact ? slice.index + 1 : t('slice.number', { number: slice.index + 1 })}
          </button>
        );
      })}
    </div>
  );
}
