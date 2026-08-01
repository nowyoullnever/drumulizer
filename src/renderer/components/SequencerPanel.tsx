import {
  MAX_EVENT_PITCH_SEMITONES,
  MAX_EVENT_VELOCITY,
  MAX_PATTERN_BARS,
  MAX_PATTERN_BPM,
  MIN_EVENT_PITCH_SEMITONES,
  MIN_EVENT_VELOCITY,
  MIN_PATTERN_BARS,
  MIN_PATTERN_BPM,
  SEQUENCER_STEPS_PER_BAR,
} from '../../shared/constants/sequencer';
import { formatDuration } from '../audio/time';
import { eventLocation, findEventAt, totalPatternSteps } from '../sequencer/patternModel';
import type {
  SequencerEvent,
  SequencerLaneId,
  SequencerPattern,
  SequencerSliceContext,
  SequencerTool,
  SequencerTransportState,
  PatternGeneratorSettings,
  PatternMutationState,
} from '../sequencer/types';
import type { GenerationSummary } from '../sequencer/generator/generatorTypes';
import type { KeyboardEvent } from 'react';
import { sequencerLaneOrder } from '../sequencer/types';
import { useI18n } from '../i18n/useI18n';
import { PixelButton } from './PixelButton';
import { PixelNumberInput } from './PixelNumberInput';
import { PixelSlider } from './PixelSlider';

interface SequencerPanelProps {
  pattern: SequencerPattern;
  transport: SequencerTransportState;
  tool: SequencerTool;
  activeSlice: SequencerSliceContext | null;
  selectedEvent: SequencerEvent | null;
  selectedEventContext: SequencerSliceContext | null;
  sliceContextById: Record<string, SequencerSliceContext>;
  selectedEventId: string | null;
  focusedLaneId: SequencerLaneId;
  focusedStepIndex: number;
  masterGain: number;
  generatorSettings: PatternGeneratorSettings;
  mutationState: PatternMutationState;
  generatorReady: boolean;
  generatorReason: string | null;
  generationSummary: GenerationSummary | null;
  onToolChange: (tool: SequencerTool) => void;
  onBpmChange: (bpm: number) => void;
  onBarsChange: (bars: number) => void;
  onLoopChange: (enabled: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onGridAction: (laneId: SequencerLaneId, stepIndex: number) => void;
  onFocusCell: (laneId: SequencerLaneId, stepIndex: number) => void;
  onClearActiveSlice: () => void;
  onAuditionActiveSlice: () => void;
  onLaneMute: (laneId: SequencerLaneId, muted: boolean) => void;
  onLaneSolo: (laneId: SequencerLaneId, soloed: boolean) => void;
  onLaneGain: (laneId: SequencerLaneId, gainDb: number) => void;
  onLaneGenerationLock: (laneId: SequencerLaneId, locked: boolean) => void;
  onClearLane: (laneId: SequencerLaneId) => void;
  onClearPattern: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUpdateEvent: (
    eventId: string,
    patch: Partial<Pick<SequencerEvent, 'velocity' | 'pan' | 'pitchSemitones'>>,
  ) => void;
  onReplaceSelectedEvent: () => void;
  onResetSelectedEvent: () => void;
  onRemoveSelectedEvent: () => void;
  onAuditionSelectedEvent: () => void;
  onGeneratorSettingsChange: (settings: PatternGeneratorSettings) => void;
  onGeneratePattern: () => void;
  onRegeneratePattern: () => void;
  onMutatePattern: () => void;
  onRandomizeSeed: () => void;
  onCopySeed: () => void;
  onResetGeneratorSettings: () => void;
  onToggleSelectedEventLock: () => void;
  onLockAllEvents: () => void;
  onUnlockAllEvents: () => void;
}

const roleLetter: Record<string, string> = {
  low: 'L',
  mid: 'M',
  high: 'H',
  texture: 'T',
  unclassified: '?',
};

export function SequencerPanel({
  pattern,
  transport,
  tool,
  activeSlice,
  selectedEvent,
  selectedEventContext,
  sliceContextById,
  selectedEventId,
  focusedLaneId,
  focusedStepIndex,
  masterGain,
  generatorSettings,
  mutationState,
  generatorReady,
  generatorReason,
  generationSummary,
  onToolChange,
  onBpmChange,
  onBarsChange,
  onLoopChange,
  onPlay,
  onPause,
  onStop,
  onGridAction,
  onFocusCell,
  onClearActiveSlice,
  onAuditionActiveSlice,
  onLaneMute,
  onLaneSolo,
  onLaneGain,
  onLaneGenerationLock,
  onClearLane,
  onClearPattern,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onUpdateEvent,
  onReplaceSelectedEvent,
  onResetSelectedEvent,
  onRemoveSelectedEvent,
  onAuditionSelectedEvent,
  onGeneratorSettingsChange,
  onGeneratePattern,
  onRegeneratePattern,
  onMutatePattern,
  onRandomizeSeed,
  onCopySeed,
  onResetGeneratorSettings,
  onToggleSelectedEventLock,
  onLockAllEvents,
  onUnlockAllEvents,
}: SequencerPanelProps) {
  const { t } = useI18n();
  const locked = transport.status !== 'stopped';
  const steps = totalPatternSteps(pattern);
  const anySolo = sequencerLaneOrder.some((laneId) => pattern.lanes[laneId].soloed);

  const handleGridKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    let nextLaneIndex = sequencerLaneOrder.indexOf(focusedLaneId);
    let nextStep = focusedStepIndex;
    if (event.key === 'ArrowLeft') nextStep -= 1;
    else if (event.key === 'ArrowRight') nextStep += 1;
    else if (event.key === 'ArrowUp') nextLaneIndex -= 1;
    else if (event.key === 'ArrowDown') nextLaneIndex += 1;
    else if (event.key === 'Home') nextStep = 0;
    else if (event.key === 'End') nextStep = steps - 1;
    else if (event.key === 'Enter') {
      event.preventDefault();
      onGridAction(focusedLaneId, focusedStepIndex);
      return;
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (selectedEventId) onRemoveSelectedEvent();
      return;
    } else return;
    event.preventDefault();
    onFocusCell(
      sequencerLaneOrder[Math.max(0, Math.min(sequencerLaneOrder.length - 1, nextLaneIndex))],
      Math.max(0, Math.min(steps - 1, nextStep)),
    );
  };

  return (
    <div className="sequencer">
      <div className="sequencer__top">
        <div className="pattern-transport" aria-label={t('sequencer.transport')}>
          <strong>{t('sequencer.transport')}</strong>
          <div className="pattern-transport__buttons">
            <PixelButton onClick={onPlay} disabled={transport.status === 'playing'}>
              {transport.status === 'paused' ? t('sequencer.resume') : t('sequencer.play')}
            </PixelButton>
            <PixelButton onClick={onPause} disabled={transport.status !== 'playing'}>
              {t('sequencer.pause')}
            </PixelButton>
            <PixelButton onClick={onStop} disabled={transport.status === 'stopped'}>
              {t('sequencer.stop')}
            </PixelButton>
            <PixelButton
              onClick={() => onLoopChange(!pattern.loopEnabled)}
              tone={pattern.loopEnabled ? 'active' : 'neutral'}
              aria-pressed={pattern.loopEnabled}
            >
              {t('sequencer.loop')}
            </PixelButton>
          </div>
          <span>
            {t('sequencer.stepReadout', {
              step: transport.currentStep + 1,
              total: steps,
            })}
          </span>
          <span>{t(`sequencer.status.${transport.status}`)}</span>
        </div>

        <div className="sequencer-settings">
          <PixelNumberInput
            label={t('sequencer.bpm')}
            min={MIN_PATTERN_BPM}
            max={MAX_PATTERN_BPM}
            step={1}
            value={pattern.bpm}
            disabled={locked}
            onChange={(event) => onBpmChange(Number(event.currentTarget.value))}
          />
          <PixelNumberInput
            label={t('sequencer.bars')}
            min={MIN_PATTERN_BARS}
            max={MAX_PATTERN_BARS}
            step={1}
            value={pattern.bars}
            disabled={locked}
            onChange={(event) => onBarsChange(Number(event.currentTarget.value))}
          />
        </div>

        <div className="sequencer-tools" role="group" aria-label={t('sequencer.tools')}>
          {(['select', 'paint', 'erase'] as SequencerTool[]).map((candidate) => (
            <PixelButton
              key={candidate}
              onClick={() => onToolChange(candidate)}
              tone={tool === candidate ? 'active' : 'neutral'}
              aria-pressed={tool === candidate}
            >
              {t(`sequencer.tool.${candidate}`)}
            </PixelButton>
          ))}
        </div>
      </div>

      {locked ? <p className="sequencer-lock">{t('sequencer.editLocked')}</p> : null}

      <PatternGeneratorPanel
        settings={generatorSettings}
        mutationState={mutationState}
        ready={generatorReady}
        reason={generatorReason}
        summary={generationSummary}
        locked={locked}
        onSettingsChange={onGeneratorSettingsChange}
        onGenerate={onGeneratePattern}
        onRegenerate={onRegeneratePattern}
        onMutate={onMutatePattern}
        onRandomizeSeed={onRandomizeSeed}
        onCopySeed={onCopySeed}
        onResetSettings={onResetGeneratorSettings}
      />

      <div className="active-slice-module">
        <strong>{t('sequencer.activeSlice')}</strong>
        {activeSlice ? (
          <>
            <span>{t('slice.number', { number: activeSlice.slice.index + 1 })}</span>
            <span>{t(`sliceRole.${activeSlice.effectiveRole}`)}</span>
            <span>{formatDuration(activeSlice.slice.durationSeconds)}</span>
            <span>
              {activeSlice.excluded ? t('sequencer.excludedSlice') : t('sliceLibrary.include')}
            </span>
            <span>
              {activeSlice.confidence !== null
                ? `${Math.round(activeSlice.confidence * 100)}%`
                : t('sliceAnalysis.notReady')}
            </span>
            <PixelButton onClick={onAuditionActiveSlice}>{t('slice.audition')}</PixelButton>
            <PixelButton onClick={onClearActiveSlice}>
              {t('sequencer.clearActiveSlice')}
            </PixelButton>
          </>
        ) : (
          <span>{t('sequencer.noActiveSlice')}</span>
        )}
      </div>

      <div className="sequencer-grid-shell">
        <div
          className="sequencer-grid"
          role="grid"
          aria-label={t('sequencer.grid')}
          tabIndex={0}
          style={{ gridTemplateColumns: `190px repeat(${steps}, minmax(38px, 1fr))` }}
          onKeyDown={handleGridKey}
        >
          <div className="sequencer-grid__corner" />
          {Array.from({ length: steps }, (_, stepIndex) => (
            <div
              key={`head-${stepIndex}`}
              className={`sequencer-grid__step-head${stepIndex % SEQUENCER_STEPS_PER_BAR === 0 ? ' sequencer-grid__step-head--bar' : ''}${stepIndex % 4 === 0 ? ' sequencer-grid__step-head--beat' : ''}`}
            >
              {stepIndex % SEQUENCER_STEPS_PER_BAR === 0
                ? t('sequencer.barNumber', { number: stepIndex / SEQUENCER_STEPS_PER_BAR + 1 })
                : stepIndex + 1}
            </div>
          ))}

          {sequencerLaneOrder.map((laneId) => {
            const lane = pattern.lanes[laneId];
            const audible = lane.muted ? false : anySolo ? lane.soloed : true;
            return (
              <div className={`sequencer-lane sequencer-lane--${laneId}`} key={laneId} role="row">
                <div className="sequencer-lane__header">
                  <strong>{t(`sliceRole.${laneId}`)}</strong>
                  <span>{roleLetter[laneId]}</span>
                  <PixelButton
                    onClick={() => onLaneMute(laneId, !lane.muted)}
                    tone={lane.muted ? 'active' : 'neutral'}
                    aria-pressed={lane.muted}
                  >
                    {t('sequencer.mute')}
                  </PixelButton>
                  <PixelButton
                    onClick={() => onLaneSolo(laneId, !lane.soloed)}
                    tone={lane.soloed ? 'active' : 'neutral'}
                    aria-pressed={lane.soloed}
                  >
                    {t('sequencer.solo')}
                  </PixelButton>
                  <PixelButton
                    onClick={() => onLaneGenerationLock(laneId, !lane.generationLocked)}
                    tone={lane.generationLocked ? 'active' : 'neutral'}
                    aria-pressed={lane.generationLocked}
                  >
                    {t('generator.laneLock')}
                  </PixelButton>
                  <PixelSlider
                    label={t('sequencer.laneVolume')}
                    min={-24}
                    max={6}
                    step={1}
                    value={lane.gainDb}
                    onChange={(event) => onLaneGain(laneId, Number(event.currentTarget.value))}
                  />
                  <span>
                    {t('sequencer.eventCount', {
                      count: pattern.events.filter((event) => event.laneId === laneId).length,
                    })}
                  </span>
                  <PixelButton onClick={() => onClearLane(laneId)} disabled={locked}>
                    {t('sequencer.clearLane')}
                  </PixelButton>
                </div>
                {Array.from({ length: steps }, (_, stepIndex) => {
                  const event = findEventAt(pattern, laneId, stepIndex);
                  const context = event ? (sliceContextById[event.sliceId] ?? null) : null;
                  const mismatch =
                    event &&
                    context &&
                    context.effectiveRole !== 'unclassified' &&
                    context.effectiveRole !== laneId;
                  const selected = event?.id === selectedEventId;
                  const playhead =
                    stepIndex === transport.currentStep && transport.status === 'playing';
                  const focused = focusedLaneId === laneId && focusedStepIndex === stepIndex;
                  return (
                    <button
                      key={`${laneId}-${stepIndex}`}
                      type="button"
                      role="gridcell"
                      className={`sequencer-step sequencer-step--${laneId}${event ? ' sequencer-step--occupied' : ''}${event ? ` sequencer-step--origin-${event.origin}` : ''}${event?.locked ? ' sequencer-step--locked' : ''}${selected ? ' sequencer-step--selected' : ''}${playhead ? ' sequencer-step--playhead' : ''}${!audible ? ' sequencer-step--muted' : ''}${mismatch ? ' sequencer-step--mismatch' : ''}${focused ? ' sequencer-step--focused' : ''}`}
                      aria-selected={selected}
                      aria-label={t('sequencer.stepLabel', {
                        lane: t(`sliceRole.${laneId}`),
                        step: stepIndex + 1,
                        state: event ? t('sequencer.occupied') : t('sequencer.empty'),
                      })}
                      onFocus={() => onFocusCell(laneId, stepIndex)}
                      onClick={() => onGridAction(laneId, stepIndex)}
                    >
                      {event ? (
                        <>
                          <span>{context ? context.slice.index + 1 : '!'}</span>
                          <small>{context ? roleLetter[context.effectiveRole] : '!'}</small>
                          <i style={{ height: `${Math.max(18, event.velocity * 100)}%` }} />
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sequencer-footer-actions">
        <PixelButton onClick={onUndo} disabled={locked || !canUndo}>
          {t('sequencer.undo')}
        </PixelButton>
        <PixelButton onClick={onRedo} disabled={locked || !canRedo}>
          {t('sequencer.redo')}
        </PixelButton>
        <PixelButton
          onClick={onClearPattern}
          disabled={locked || pattern.events.length === 0}
          tone="danger"
        >
          {t('sequencer.clearPattern')}
        </PixelButton>
      </div>

      <EventInspector
        event={selectedEvent}
        context={selectedEventContext}
        activeSlice={activeSlice}
        locked={locked}
        masterGain={masterGain}
        onUpdateEvent={onUpdateEvent}
        onReplace={onReplaceSelectedEvent}
        onReset={onResetSelectedEvent}
        onRemove={onRemoveSelectedEvent}
        onAudition={onAuditionSelectedEvent}
        onToggleLock={onToggleSelectedEventLock}
        onLockAll={onLockAllEvents}
        onUnlockAll={onUnlockAllEvents}
      />
    </div>
  );
}

function PatternGeneratorPanel({
  settings,
  mutationState,
  ready,
  reason,
  summary,
  locked,
  onSettingsChange,
  onGenerate,
  onRegenerate,
  onMutate,
  onRandomizeSeed,
  onCopySeed,
  onResetSettings,
}: {
  settings: PatternGeneratorSettings;
  mutationState: PatternMutationState;
  ready: boolean;
  reason: string | null;
  summary: GenerationSummary | null;
  locked: boolean;
  onSettingsChange: (settings: PatternGeneratorSettings) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onMutate: () => void;
  onRandomizeSeed: () => void;
  onCopySeed: () => void;
  onResetSettings: () => void;
}) {
  const { t } = useI18n();
  const disabled = locked || !ready;
  return (
    <div className="pattern-generator" aria-label={t('generator.title')}>
      <div className="pattern-generator__header">
        <strong>{t('generator.title')}</strong>
        <span>{t('generator.ruleBased')}</span>
      </div>
      <label className="generator-seed">
        <span>{t('generator.seed')}</span>
        <input
          value={settings.seed}
          maxLength={32}
          onChange={(event) => onSettingsChange({ ...settings, seed: event.currentTarget.value })}
        />
      </label>
      <div className="pattern-generator__seed-actions">
        <PixelButton onClick={onRandomizeSeed} disabled={locked}>
          {t('generator.randomizeSeed')}
        </PixelButton>
        <PixelButton onClick={onCopySeed}>{t('generator.copySeed')}</PixelButton>
        <PixelButton onClick={onResetSettings} disabled={locked}>
          {t('generator.resetSettings')}
        </PixelButton>
      </div>
      <div className="pattern-generator__sliders">
        <PixelSlider
          label={t('generator.density')}
          min={0}
          max={100}
          step={1}
          value={settings.density}
          disabled={locked}
          onChange={(event) =>
            onSettingsChange({ ...settings, density: Number(event.currentTarget.value) })
          }
        />
        <PixelSlider
          label={t('generator.variation')}
          min={0}
          max={100}
          step={1}
          value={settings.variation}
          disabled={locked}
          onChange={(event) =>
            onSettingsChange({ ...settings, variation: Number(event.currentTarget.value) })
          }
        />
        <PixelSlider
          label={t('generator.breakage')}
          min={0}
          max={100}
          step={1}
          value={settings.breakage}
          disabled={locked}
          onChange={(event) =>
            onSettingsChange({ ...settings, breakage: Number(event.currentTarget.value) })
          }
        />
      </div>
      <div className="pattern-generator__selects">
        <label>
          <span>{t('generator.mode')}</span>
          <select
            value={settings.mode}
            disabled={locked}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                mode: event.currentTarget.value as PatternGeneratorSettings['mode'],
              })
            }
          >
            <option value="preserve-manual">{t('generator.mode.preserveManual')}</option>
            <option value="replace-unlocked">{t('generator.mode.replaceUnlocked')}</option>
          </select>
        </label>
        <label>
          <span>{t('generator.scope')}</span>
          <select
            value={settings.scope}
            disabled={locked}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                scope: event.currentTarget.value as PatternGeneratorSettings['scope'],
              })
            }
          >
            <option value="all">{t('generator.scope.all')}</option>
            {sequencerLaneOrder.map((laneId) => (
              <option value={laneId} key={laneId}>
                {t(`sliceRole.${laneId}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!ready && reason ? (
        <p className="sequencer-warning">{t(reason as Parameters<typeof t>[0])}</p>
      ) : null}
      <div className="pattern-generator__actions">
        <PixelButton onClick={onGenerate} disabled={disabled}>
          {t('generator.generate')}
        </PixelButton>
        <PixelButton onClick={onRegenerate} disabled={disabled}>
          {t('generator.regenerate')}
        </PixelButton>
        <PixelButton onClick={onMutate} disabled={disabled}>
          {t('generator.mutate')}
        </PixelButton>
      </div>
      {summary ? (
        <p className="generator-summary">
          {t(summary.messageKey as Parameters<typeof t>[0], {
            added: summary.added,
            removed: summary.removed,
            changed: summary.changed,
            preserved: summary.preserved,
            mutation: mutationState.mutationIndex,
          })}
        </p>
      ) : null}
    </div>
  );
}

function EventInspector({
  event,
  context,
  activeSlice,
  locked,
  masterGain,
  onUpdateEvent,
  onReplace,
  onReset,
  onRemove,
  onAudition,
  onToggleLock,
  onLockAll,
  onUnlockAll,
}: {
  event: SequencerEvent | null;
  context: SequencerSliceContext | null;
  activeSlice: SequencerSliceContext | null;
  locked: boolean;
  masterGain: number;
  onUpdateEvent: SequencerPanelProps['onUpdateEvent'];
  onReplace: () => void;
  onReset: () => void;
  onRemove: () => void;
  onAudition: () => void;
  onToggleLock: () => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
}) {
  const { t } = useI18n();
  if (!event) {
    return (
      <div className="event-inspector">
        <strong>{t('sequencer.eventInspector')}</strong>
        <p>{t('sequencer.noEventSelected')}</p>
      </div>
    );
  }
  const location = eventLocation(event);
  const mismatch =
    context && context.effectiveRole !== 'unclassified' && context.effectiveRole !== event.laneId;
  return (
    <div className="event-inspector">
      <strong>{t('sequencer.eventInspector')}</strong>
      <dl>
        <div>
          <dt>{t('sequencer.lane')}</dt>
          <dd>{t(`sliceRole.${event.laneId}`)}</dd>
        </div>
        <div>
          <dt>{t('sequencer.step')}</dt>
          <dd>{event.stepIndex + 1}</dd>
        </div>
        <div>
          <dt>{t('sequencer.barBeat')}</dt>
          <dd>
            {location.bar}.{location.beat}.{location.stepInBeat}
          </dd>
        </div>
        <div>
          <dt>{t('panel.selectedSlice')}</dt>
          <dd>
            {context
              ? t('slice.number', { number: context.slice.index + 1 })
              : t('sequencer.invalidSlice')}
          </dd>
        </div>
        <div>
          <dt>{t('generator.origin')}</dt>
          <dd>{t(`generator.origin.${event.origin}`)}</dd>
        </div>
        <div>
          <dt>{t('generator.eventLock')}</dt>
          <dd>{event.locked ? t('common.on') : t('common.off')}</dd>
        </div>
        <div>
          <dt>{t('sliceRole.low')}</dt>
          <dd>{context ? t(`sliceRole.${context.effectiveRole}`) : '-'}</dd>
        </div>
      </dl>
      {context?.excluded ? (
        <p className="sequencer-warning">{t('sequencer.excludedSlice')}</p>
      ) : null}
      {mismatch ? <p className="sequencer-warning">{t('sequencer.roleMismatch')}</p> : null}
      {!context ? <p className="sequencer-warning">{t('sequencer.invalidSlice')}</p> : null}
      {locked ? <p className="sequencer-lock">{t('sequencer.editLocked')}</p> : null}

      <PixelSlider
        label={t('sequencer.velocity')}
        min={MIN_EVENT_VELOCITY * 100}
        max={MAX_EVENT_VELOCITY * 100}
        step={1}
        value={Math.round(event.velocity * 100)}
        disabled={locked}
        onChange={(change) =>
          onUpdateEvent(event.id, { velocity: Number(change.currentTarget.value) / 100 })
        }
      />
      <PixelSlider
        label={t('sequencer.pan')}
        min={-100}
        max={100}
        step={1}
        value={Math.round(event.pan * 100)}
        disabled={locked}
        onChange={(change) =>
          onUpdateEvent(event.id, { pan: Number(change.currentTarget.value) / 100 })
        }
      />
      <PixelSlider
        label={t('sequencer.pitch')}
        min={MIN_EVENT_PITCH_SEMITONES}
        max={MAX_EVENT_PITCH_SEMITONES}
        step={1}
        value={event.pitchSemitones}
        disabled={locked}
        onChange={(change) =>
          onUpdateEvent(event.id, { pitchSemitones: Number(change.currentTarget.value) })
        }
      />
      <p className="muted-label">
        {t('sequencer.masterGainPreview', { value: Math.round(masterGain * 100) })}
      </p>
      <div className="event-inspector__actions">
        <PixelButton onClick={onAudition} disabled={locked || !context}>
          {t('sequencer.auditionEvent')}
        </PixelButton>
        <PixelButton onClick={onReplace} disabled={locked || !activeSlice}>
          {t('sequencer.replaceWithActiveSlice')}
        </PixelButton>
        <PixelButton onClick={onReset} disabled={locked}>
          {t('sequencer.resetParameters')}
        </PixelButton>
        <PixelButton onClick={onRemove} disabled={locked} tone="danger">
          {t('sequencer.removeEvent')}
        </PixelButton>
        <PixelButton onClick={onToggleLock} disabled={locked}>
          {event.locked ? t('generator.unlockEvent') : t('generator.lockEvent')}
        </PixelButton>
        <PixelButton onClick={onLockAll} disabled={locked}>
          {t('generator.lockAll')}
        </PixelButton>
        <PixelButton onClick={onUnlockAll} disabled={locked}>
          {t('generator.unlockAll')}
        </PixelButton>
      </div>
    </div>
  );
}
