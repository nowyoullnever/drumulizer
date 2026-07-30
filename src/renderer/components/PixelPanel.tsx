import type { ReactNode } from 'react';

interface PixelPanelProps {
  title?: string;
  accent?: 'tomato' | 'mustard' | 'cobalt' | 'teal' | 'violet';
  children: ReactNode;
  className?: string;
}

export function PixelPanel({
  title,
  accent = 'cobalt',
  children,
  className = '',
}: PixelPanelProps) {
  return (
    <section className={`pixel-panel pixel-panel--${accent} ${className}`.trim()}>
      {title ? <div className="pixel-panel__title">{title}</div> : null}
      <div className="pixel-panel__body">{children}</div>
    </section>
  );
}
