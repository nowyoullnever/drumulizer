import type { PlaybackSnapshot } from '../audio/types';
import { formatSeconds } from '../audio/time';
import { useI18n } from '../i18n/useI18n';
import { PixelButton } from './PixelButton';
import { PixelIconButton } from './PixelIconButton';
import { PixelSlider } from './PixelSlider';
import { PixelToggle } from './PixelToggle';

interface TransportControlsProps {
  playback: PlaybackSnapshot;
  hasSource: boolean;
  zoom: number;
  viewportStart: number;
  viewportEnd: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onLoopChange: (enabled: boolean) => void;
  onGainChange: (gain: number) => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
}

export function TransportControls({
  playback,
  hasSource,
  zoom,
  viewportStart,
  viewportEnd,
  onPlay,
  onPause,
  onStop,
  onLoopChange,
  onGainChange,
  onFit,
  onZoomIn,
  onZoomOut,
  onZoomChange,
}: TransportControlsProps) {
  const { t } = useI18n();

  return (
    <div className="transport">
      <div className="transport__row">
        <PixelIconButton
          label={t('transport.play')}
          icon="PLAY"
          onClick={onPlay}
          disabled={!hasSource}
        />
        <PixelIconButton
          label={t('transport.pause')}
          icon="PAUSE"
          onClick={onPause}
          disabled={playback.status !== 'playing'}
        />
        <PixelIconButton
          label={t('transport.stop')}
          icon="STOP"
          onClick={onStop}
          disabled={!hasSource}
        />
        <PixelToggle
          label={t('transport.loop')}
          checked={playback.loopEnabled}
          onChange={(event) => onLoopChange(event.currentTarget.checked)}
          disabled={!hasSource}
        />
      </div>

      <div className="transport__time" aria-label={t('transport.timeLabel')}>
        <span>{formatSeconds(playback.positionSeconds)}</span>
        <span>/</span>
        <strong>{formatSeconds(playback.durationSeconds)}</strong>
      </div>

      <PixelSlider
        label={t('transport.master')}
        min={0}
        max={100}
        value={Math.round(playback.masterGain * 100)}
        onChange={(event) => onGainChange(Number(event.currentTarget.value) / 100)}
        disabled={!hasSource}
      />

      <div className="transport__row">
        <PixelButton onClick={onFit} disabled={!hasSource}>
          {t('transport.fit')}
        </PixelButton>
        <PixelIconButton
          label={t('transport.zoomOut')}
          icon="-"
          onClick={onZoomOut}
          disabled={!hasSource}
        />
        <PixelIconButton
          label={t('transport.zoomIn')}
          icon="+"
          onClick={onZoomIn}
          disabled={!hasSource}
        />
      </div>

      <PixelSlider
        label={t('transport.zoom')}
        min={1}
        max={16}
        value={zoom}
        onChange={(event) => onZoomChange(Number(event.currentTarget.value))}
        disabled={!hasSource}
      />

      <div className="viewport-readout">
        {t('transport.viewport', {
          start: formatSeconds(viewportStart),
          end: formatSeconds(viewportEnd),
        })}
      </div>
    </div>
  );
}
