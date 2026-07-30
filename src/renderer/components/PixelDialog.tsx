import { useEffect, useRef, type ReactNode } from 'react';
import { PixelButton } from './PixelButton';

interface PixelDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}

export function PixelDialog({
  open,
  title,
  children,
  onClose,
  closeLabel = 'Close',
}: PixelDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pixel-dialog-backdrop" role="presentation">
      <div
        className="pixel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pixel-dialog-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="pixel-dialog__header pattern pattern--stepped">
          <h2 id="pixel-dialog-title">{title}</h2>
          <PixelButton onClick={onClose}>{closeLabel}</PixelButton>
        </header>
        <div className="pixel-dialog__body">{children}</div>
      </div>
    </div>
  );
}
