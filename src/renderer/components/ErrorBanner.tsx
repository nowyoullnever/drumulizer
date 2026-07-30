interface ErrorBannerProps {
  title: string;
  message: string;
}

export function ErrorBanner({ title, message }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
