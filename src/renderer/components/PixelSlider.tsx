import type { InputHTMLAttributes } from 'react';

interface PixelSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function PixelSlider({ label, id, value, ...props }: PixelSliderProps) {
  const sliderId = id ?? `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label className="pixel-slider" htmlFor={sliderId}>
      <span>{label}</span>
      <input id={sliderId} type="range" value={value} {...props} />
      <output>{value}</output>
    </label>
  );
}
