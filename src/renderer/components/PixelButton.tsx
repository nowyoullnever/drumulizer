import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: 'neutral' | 'active' | 'danger';
}

export function PixelButton({
  children,
  tone = 'neutral',
  className = '',
  ...props
}: PixelButtonProps) {
  return (
    <button className={`pixel-button pixel-button--${tone} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
