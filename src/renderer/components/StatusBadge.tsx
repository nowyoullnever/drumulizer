import type { AppStatus } from '../../shared/types/app';

interface StatusBadgeProps {
  status: AppStatus | 'offline' | 'disabled';
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{label}</span>;
}
