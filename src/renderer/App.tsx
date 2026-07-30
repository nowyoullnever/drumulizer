import { useMemo, useState } from 'react';
import { APP_VERSION } from '../shared/version';
import type { AppStatus, DrumulizerAppInfo } from '../shared/types/app';
import { ErrorBanner } from './components/ErrorBanner';
import { PatternBackground } from './components/PatternBackground';
import { PixelButton } from './components/PixelButton';
import { PixelDialog } from './components/PixelDialog';
import { PixelIconButton } from './components/PixelIconButton';
import { PixelNumberInput } from './components/PixelNumberInput';
import { PixelPanel } from './components/PixelPanel';
import { PixelProgressBar } from './components/PixelProgressBar';
import { PixelSectionHeader } from './components/PixelSectionHeader';
import { PixelSlider } from './components/PixelSlider';
import { PixelTabs } from './components/PixelTabs';
import { PixelToggle } from './components/PixelToggle';
import { PixelTooltip } from './components/PixelTooltip';
import { StatusBadge } from './components/StatusBadge';

const fallbackInfo: DrumulizerAppInfo = {
  name: 'Drumulizer',
  version: APP_VERSION,
  platform: 'renderer-preview',
};

export function App() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [density, setDensity] = useState(36);
  const [selectedTab, setSelectedTab] = useState('LOW');
  const [status] = useState<AppStatus>('ready');

  const appInfo = useMemo(() => window.drumulizer?.getAppInfo() ?? fallbackInfo, []);

  return (
    <main className="app">
      <header className="identity-strip">
        <PatternBackground preset="checker" className="identity-strip__mark" />
        <div>
          <h1>DRUMULIZER / v{appInfo.version}</h1>
          <p>프로젝트: UNTITLED / LOCAL PROCESSING ONLY</p>
        </div>
        <div className="identity-strip__status">
          <StatusBadge status="offline" label="OFFLINE" />
          <StatusBadge status={status} label="READY" />
          <PixelTooltip label="About Drumulizer">
            <PixelIconButton
              label="Open about dialog"
              icon="?"
              onClick={() => setAboutOpen(true)}
            />
          </PixelTooltip>
        </div>
      </header>

      <section className="project-status">
        <strong>PROJECT STATUS</strong>
        <span>NO SAMPLE LOADED</span>
        <span>ANALYSIS MODULE NOT INSTALLED</span>
        <span>PATTERN ENGINE OFFLINE</span>
      </section>

      <div className="workspace-grid">
        <aside className="left-rail">
          <PixelPanel title="SOURCE" accent="tomato">
            <div className="empty-module pattern pattern--diagonal">
              <strong>NO SAMPLE LOADED</strong>
              <span>Audio import arrives in v0.2.0</span>
            </div>
          </PixelPanel>

          <PixelPanel title="ANALYSIS" accent="mustard">
            <div className="status-stack">
              <StatusBadge status="offline" label="LOCAL ONLY" />
              <StatusBadge status="disabled" label="NOT INSTALLED" />
              <p>
                Offline analysis architecture is reserved, but no audio engine is present in v0.1.0.
              </p>
            </div>
          </PixelPanel>
        </aside>

        <section className="main-workspace">
          <PixelSectionHeader label="SAMPLE WORKSPACE" code="v0.2.0 RESERVED" />
          <div className="sample-placeholder">
            <PatternBackground preset="halftone" className="sample-placeholder__pattern" />
            <div className="sample-placeholder__content">
              <strong>WAVEFORM MODULE ARRIVES IN v0.2.0</strong>
              <span>Future waveform and slice editor area. No audio decoding is initialized.</span>
            </div>
          </div>

          <PixelSectionHeader label="PATTERN WORKSPACE" code="FOUNDATION PREVIEW" />
          <div className="pattern-workspace">
            <PixelTabs
              tabs={['LOW', 'MID', 'HIGH', 'TEXTURE']}
              selected={selectedTab}
              onSelect={setSelectedTab}
            />
            <div className={`lane-preview lane-preview--${selectedTab.toLowerCase()}`}>
              <strong>{selectedTab} LANE VISUAL RESERVATION</strong>
              <span>
                Future IDM sequencing surface. Timing and playback are intentionally absent.
              </span>
            </div>
          </div>
        </section>

        <aside className="control-rail">
          <PixelPanel title="FOUNDATION CONTROLS" accent="teal">
            <PixelToggle
              label="Example toggle"
              checked={armed}
              onChange={(event) => setArmed(event.currentTarget.checked)}
            />
            <PixelSlider
              label="Example slider"
              min={0}
              max={100}
              value={density}
              onChange={(event) => setDensity(Number(event.currentTarget.value))}
            />
            <PixelNumberInput label="Grid unit" value={2} min={2} max={32} disabled />
            <PixelProgressBar label="Foundation" value={64} />
            <PixelButton onClick={() => setAboutOpen(true)} tone="active">
              ABOUT
            </PixelButton>
          </PixelPanel>

          {import.meta.env.DEV ? (
            <PixelPanel title="DEV SHOWCASE" accent="violet">
              <ErrorBanner
                title="DEVELOPMENT ONLY"
                message="Error banner and layer swatches are hidden from production evaluation."
              />
              <div className="swatches" aria-label="Future lane color reservations">
                <span className="swatch swatch--low">LOW</span>
                <span className="swatch swatch--mid">MID</span>
                <span className="swatch swatch--high">HIGH</span>
                <span className="swatch swatch--texture">TEXTURE</span>
              </div>
            </PixelPanel>
          ) : null}
        </aside>
      </div>

      <footer className="bottom-strip">
        <StatusBadge status="offline" label="OFFLINE" />
        <span>CPU --</span>
        <span>VOICES --</span>
        <span>CACHE --</span>
        <span>STATUS {status.toUpperCase()}</span>
        <strong>Drumulizer v{appInfo.version}</strong>
      </footer>

      <PixelDialog open={aboutOpen} title="ABOUT DRUMULIZER" onClose={() => setAboutOpen(false)}>
        <p>
          Drumulizer v{appInfo.version} is a fully offline desktop foundation for future
          sample-based IDM drum-loop generation.
        </p>
        <p>
          Runtime network APIs, telemetry, cloud AI, remote fonts, and remote assets are forbidden.
        </p>
        <p>Typeface: x10y12pxDenkiChipHangul, bundled locally under the SIL Open Font License.</p>
        <p>Repository: nowyoullnever/drumulizer</p>
      </PixelDialog>
    </main>
  );
}
