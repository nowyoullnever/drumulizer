import type { PlaybackSnapshot } from '../audio/types';
import { formatSeconds } from '../audio/time';
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
  return (
    <div className="transport">
      <div className="transport__row">
        <PixelIconButton label="재생" icon="PLAY" onClick={onPlay} disabled={!hasSource} />
        <PixelIconButton
          label="일시정지"
          icon="PAUSE"
          onClick={onPause}
          disabled={playback.status !== 'playing'}
        />
        <PixelIconButton label="정지" icon="STOP" onClick={onStop} disabled={!hasSource} />
        <PixelToggle
          label="Loop"
          checked={playback.loopEnabled}
          onChange={(event) => onLoopChange(event.currentTarget.checked)}
          disabled={!hasSource}
        />
      </div>

      <div className="transport__time" aria-label="재생 시간">
        <span>{formatSeconds(playback.positionSeconds)}</span>
        <span>/</span>
        <strong>{formatSeconds(playback.durationSeconds)}</strong>
      </div>

      <PixelSlider
        label="Master"
        min={0}
        max={100}
        value={Math.round(playback.masterGain * 100)}
        onChange={(event) => onGainChange(Number(event.currentTarget.value) / 100)}
        disabled={!hasSource}
      />

      <div className="transport__row">
        <PixelButton onClick={onFit} disabled={!hasSource}>
          FIT
        </PixelButton>
        <PixelIconButton label="축소" icon="-" onClick={onZoomOut} disabled={!hasSource} />
        <PixelIconButton label="확대" icon="+" onClick={onZoomIn} disabled={!hasSource} />
      </div>

      <PixelSlider
        label="Zoom"
        min={1}
        max={16}
        value={zoom}
        onChange={(event) => onZoomChange(Number(event.currentTarget.value))}
        disabled={!hasSource}
      />

      <div className="viewport-readout">
        보기 {formatSeconds(viewportStart)} - {formatSeconds(viewportEnd)}
      </div>
    </div>
  );
}
