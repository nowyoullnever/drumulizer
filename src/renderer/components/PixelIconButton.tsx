import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PixelIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function PixelIconButton({ icon, label, className = '', ...props }: PixelIconButtonProps) {
  return (
    <button
      className={`pixel-icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}
