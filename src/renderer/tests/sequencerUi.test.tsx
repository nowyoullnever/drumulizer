import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SequencerPanel } from '../components/SequencerPanel';
import { I18nProvider } from '../i18n/I18nProvider';
import { localeStorageKey } from '../i18n/localeStorage';
import {
  createDefaultGeneratorSettings,
  createDefaultMutationState,
} from '../sequencer/generator/generatorTypes';
import {
  createDefaultIDMTransformMutationState,
  createDefaultIDMTransformSettings,
} from '../sequencer/transform/idmTransform';
import { createDefaultPattern, paintEvent } from '../sequencer/patternModel';
import type { SequencerSliceContext } from '../sequencer/types';
import type { SliceRegion } from '../slice/types';

const slice: SliceRegion = {
  id: 'slice-1',
  index: 0,
  startSample: 0,
  endSample: 4410,
  durationSamples: 4410,
  startSeconds: 0,
  endSeconds: 0.1,
  durationSeconds: 0.1,
  leftBoundaryId: 'boundary-start',
  rightBoundaryId: 'boundary-end',
};

const sliceContext: SequencerSliceContext = {
  slice,
  effectiveRole: 'low',
  excluded: false,
  confidence: 0.92,
};

const renderSequencer = (overrides: Partial<Parameters<typeof SequencerPanel>[0]> = {}) => {
  window.localStorage.setItem(localeStorageKey, 'en');
  const painted = paintEvent({
    pattern: createDefaultPattern(),
    laneId: 'low',
    stepIndex: 0,
    sliceId: slice.id,
  });
  const selectedEvent = painted.pattern.events[0];
  const props: Parameters<typeof SequencerPanel>[0] = {
    pattern: painted.pattern,
    transport: { status: 'stopped', currentStep: 0, positionBeats: 0 },
    tool: 'select',
    activeSlice: sliceContext,
    selectedEvent,
    selectedEventContext: sliceContext,
    sliceContextById: { [slice.id]: sliceContext },
    selectedEventId: selectedEvent.id,
    focusedLaneId: 'low',
    focusedStepIndex: 0,
    masterGain: 0.75,
    generatorSettings: createDefaultGeneratorSettings(),
    mutationState: createDefaultMutationState(),
    generatorReady: true,
    generatorReason: null,
    generationSummary: null,
    idmSettings: createDefaultIDMTransformSettings(),
    idmMutationState: createDefaultIDMTransformMutationState(),
    idmSummary: null,
    onToolChange: vi.fn(),
    onBpmChange: vi.fn(),
    onBarsChange: vi.fn(),
    onSwingChange: vi.fn(),
    onLoopChange: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onGridAction: vi.fn(),
    onFocusCell: vi.fn(),
    onClearActiveSlice: vi.fn(),
    onAuditionActiveSlice: vi.fn(),
    onLaneMute: vi.fn(),
    onLaneSolo: vi.fn(),
    onLaneGain: vi.fn(),
    onLaneGenerationLock: vi.fn(),
    onClearLane: vi.fn(),
    onClearPattern: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: false,
    onUpdateEvent: vi.fn(),
    onReplaceSelectedEvent: vi.fn(),
    onResetSelectedEvent: vi.fn(),
    onRemoveSelectedEvent: vi.fn(),
    onAuditionSelectedEvent: vi.fn(),
    onGeneratorSettingsChange: vi.fn(),
    onGeneratePattern: vi.fn(),
    onRegeneratePattern: vi.fn(),
    onMutatePattern: vi.fn(),
    onRandomizeSeed: vi.fn(),
    onCopySeed: vi.fn(),
    onResetGeneratorSettings: vi.fn(),
    onIDMSettingsChange: vi.fn(),
    onApplyIDMTransform: vi.fn(),
    onMutateIDMTransform: vi.fn(),
    onResetIDMTransform: vi.fn(),
    onToggleSelectedEventLock: vi.fn(),
    onLockAllEvents: vi.fn(),
    onUnlockAllEvents: vi.fn(),
    ...overrides,
  };
  return {
    ...render(
      <I18nProvider>
        <SequencerPanel {...props} />
      </I18nProvider>,
    ),
    props,
  };
};

describe('sequencer UI', () => {
  it('renders manual pattern controls and connects grid actions', async () => {
    const user = userEvent.setup();
    const { props } = renderSequencer();

    expect(screen.getByRole('grid', { name: 'Sequencer grid' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Low lane step 1, occupied' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Step 1 / 32')).toBeInTheDocument();

    await user.click(screen.getByRole('gridcell', { name: 'Low lane step 2, empty' }));
    expect(props.onGridAction).toHaveBeenCalledWith('low', 1);
  });

  it('supports keyboard navigation and event inspector edits', async () => {
    const user = userEvent.setup();
    const { props } = renderSequencer();

    const grid = screen.getByRole('grid', { name: 'Sequencer grid' });
    grid.focus();
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    fireEvent.keyDown(grid, { key: 'Delete' });

    expect(props.onFocusCell).toHaveBeenCalledWith('low', 1);
    expect(props.onGridAction).toHaveBeenCalledWith('low', 0);
    expect(props.onRemoveSelectedEvent).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Audition Event' }));
    expect(props.onAuditionSelectedEvent).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Replace with Active Slice' }));
    expect(props.onReplaceSelectedEvent).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Velocity'), { target: { value: '50' } });
    expect(props.onUpdateEvent).toHaveBeenCalledWith(props.selectedEventId, { velocity: 0.5 });
  });
});
