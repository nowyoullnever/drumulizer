import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SequencerPanel } from '../components/SequencerPanel';
import {
  createDefaultGeneratorSettings,
  createDefaultMutationState,
} from '../sequencer/generator/generatorTypes';
import {
  createDefaultIDMTransformMutationState,
  createDefaultIDMTransformSettings,
} from '../sequencer/transform/idmTransform';
import { createDefaultPattern } from '../sequencer/patternModel';
import { I18nProvider } from '../i18n/I18nProvider';
import { localeStorageKey } from '../i18n/localeStorage';

describe('generator UI', () => {
  it('renders seed controls and invokes generator actions in English', () => {
    window.localStorage.setItem(localeStorageKey, 'en');
    const handlers = {
      onGeneratorSettingsChange: vi.fn(),
      onGeneratePattern: vi.fn(),
      onRegeneratePattern: vi.fn(),
      onMutatePattern: vi.fn(),
    };
    render(
      <I18nProvider>
        <SequencerPanel
          pattern={createDefaultPattern()}
          transport={{ status: 'stopped', currentStep: 0, positionBeats: 0 }}
          tool="select"
          activeSlice={null}
          selectedEvent={null}
          selectedEventContext={null}
          sliceContextById={{}}
          selectedEventId={null}
          focusedLaneId="low"
          focusedStepIndex={0}
          masterGain={1}
          generatorSettings={createDefaultGeneratorSettings()}
          mutationState={createDefaultMutationState()}
          generatorReady
          generatorReason={null}
          generationSummary={null}
          idmSettings={createDefaultIDMTransformSettings()}
          idmMutationState={createDefaultIDMTransformMutationState()}
          idmSummary={null}
          onToolChange={vi.fn()}
          onBpmChange={vi.fn()}
          onBarsChange={vi.fn()}
          onSwingChange={vi.fn()}
          onLoopChange={vi.fn()}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
          onGridAction={vi.fn()}
          onFocusCell={vi.fn()}
          onClearActiveSlice={vi.fn()}
          onAuditionActiveSlice={vi.fn()}
          onLaneMute={vi.fn()}
          onLaneSolo={vi.fn()}
          onLaneGain={vi.fn()}
          onLaneGenerationLock={vi.fn()}
          onClearLane={vi.fn()}
          onClearPattern={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={false}
          canRedo={false}
          onUpdateEvent={vi.fn()}
          onReplaceSelectedEvent={vi.fn()}
          onResetSelectedEvent={vi.fn()}
          onRemoveSelectedEvent={vi.fn()}
          onAuditionSelectedEvent={vi.fn()}
          onRandomizeSeed={vi.fn()}
          onCopySeed={vi.fn()}
          onResetGeneratorSettings={vi.fn()}
          onIDMSettingsChange={vi.fn()}
          onApplyIDMTransform={vi.fn()}
          onMutateIDMTransform={vi.fn()}
          onResetIDMTransform={vi.fn()}
          onToggleSelectedEventLock={vi.fn()}
          onLockAllEvents={vi.fn()}
          onUnlockAllEvents={vi.fn()}
          {...handlers}
        />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: 'abc_123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Pattern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Unlocked' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mutate Pattern' }));
    expect(handlers.onGeneratorSettingsChange).toHaveBeenCalled();
    expect(handlers.onGeneratePattern).toHaveBeenCalled();
    expect(handlers.onRegeneratePattern).toHaveBeenCalled();
    expect(handlers.onMutatePattern).toHaveBeenCalled();
  });
});
