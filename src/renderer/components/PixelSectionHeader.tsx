interface PixelSectionHeaderProps {
  label: string;
  code?: string;
}

export function PixelSectionHeader({ label, code }: PixelSectionHeaderProps) {
  return (
    <header className="pixel-section-header pattern pattern--wide-band">
      <span>{label}</span>
      {code ? <small>{code}</small> : null}
    </header>
  );
}
