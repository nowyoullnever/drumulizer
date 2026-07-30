import type { ReactNode } from 'react';

interface PixelTooltipProps {
  label: string;
  children: ReactNode;
}

export function PixelTooltip({ label, children }: PixelTooltipProps) {
  return (
    <span className="pixel-tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}
