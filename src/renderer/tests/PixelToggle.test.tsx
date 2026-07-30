import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelToggle } from '../components/PixelToggle';
import { I18nProvider } from '../i18n/I18nProvider';

describe('PixelToggle', () => {
  it('is keyboard reachable and emits checked changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <I18nProvider>
        <PixelToggle label="Example toggle" checked={false} onChange={onChange} />
      </I18nProvider>,
    );

    await user.tab();
    expect(screen.getByRole('checkbox', { name: /Example toggle/i })).toHaveFocus();
    await user.keyboard('[Space]');
    expect(onChange).toHaveBeenCalled();
  });
});
