import type { ReactNode } from 'react';

export type PatternPreset = 'checker' | 'diagonal' | 'halftone' | 'stepped' | 'wide-band';

interface PatternBackgroundProps {
  preset: PatternPreset;
  children?: ReactNode;
  className?: string;
}

export function PatternBackground({ preset, children, className = '' }: PatternBackgroundProps) {
  return <div className={`pattern pattern--${preset} ${className}`.trim()}>{children}</div>;
}
