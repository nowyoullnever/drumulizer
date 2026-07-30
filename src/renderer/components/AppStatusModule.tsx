import type { AppStatus } from '../../shared/types/app';
import { useI18n } from '../i18n/useI18n';

interface AppStatusModuleProps {
  status: AppStatus;
}

export function AppStatusModule({ status }: AppStatusModuleProps) {
  const { t } = useI18n();

  return (
    <div
      className={`app-status-module app-status-module--${status}`}
      role="status"
      aria-live="polite"
    >
      <span>{t('status.label')}</span>
      <strong>{t(`status.${status}`)}</strong>
    </div>
  );
}
