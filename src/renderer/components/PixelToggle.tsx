import type { InputHTMLAttributes } from 'react';

interface PixelToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function PixelToggle({ label, id, checked, ...props }: PixelToggleProps) {
  const toggleId = id ?? `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label className="pixel-toggle" htmlFor={toggleId}>
      <input id={toggleId} type="checkbox" checked={checked} {...props} />
      <span className="pixel-toggle__mark" aria-hidden="true" />
      <span>{label}</span>
      <strong>{checked ? 'ON' : 'OFF'}</strong>
    </label>
  );
}
