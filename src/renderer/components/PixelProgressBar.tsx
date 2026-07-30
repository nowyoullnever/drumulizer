interface PixelProgressBarProps {
  label: string;
  value: number;
  max?: number;
}

export function PixelProgressBar({ label, value, max = 100 }: PixelProgressBarProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="pixel-progress" aria-label={label}>
      <span>{label}</span>
      <div className="pixel-progress__track">
        <div className="pixel-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <strong>{Math.round(percent)}%</strong>
    </div>
  );
}
