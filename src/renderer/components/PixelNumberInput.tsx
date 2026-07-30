import type { InputHTMLAttributes } from 'react';

interface PixelNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function PixelNumberInput({ label, id, ...props }: PixelNumberInputProps) {
  const inputId = id ?? `number-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label className="pixel-number-input" htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} type="number" {...props} />
    </label>
  );
}
