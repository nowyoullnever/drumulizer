import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate, type Locale } from '../i18n/translations';
import { PixelButton } from './PixelButton';

interface ErrorBoundaryProps {
  children: ReactNode;
  locale?: Locale;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Renderer error boundary caught an error.', { error, errorInfo });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const locale = this.props.locale ?? 'ko';
      return (
        <main className="app app--error">
          <section className="error-screen pattern pattern--checker">
            <h1>{translate(locale, 'errorBoundary.title')}</h1>
            <p>{translate(locale, 'errorBoundary.body')}</p>
            <PixelButton onClick={() => window.location.reload()} tone="danger">
              {translate(locale, 'errorBoundary.reload')}
            </PixelButton>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
