import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelToggle } from '../components/PixelToggle';

describe('PixelToggle', () => {
  it('is keyboard reachable and emits checked changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PixelToggle label="Example toggle" checked={false} onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole('checkbox', { name: /Example toggle/i })).toHaveFocus();
    await user.keyboard('[Space]');
    expect(onChange).toHaveBeenCalled();
  });
});
