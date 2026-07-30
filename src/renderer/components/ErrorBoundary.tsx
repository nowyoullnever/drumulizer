import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PixelButton } from './PixelButton';

interface ErrorBoundaryProps {
  children: ReactNode;
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
      return (
        <main className="app app--error">
          <section className="error-screen pattern pattern--checker">
            <h1>DRUMULIZER RENDERER ERROR</h1>
            <p>
              The interface stopped before audio modules were touched. Reload to return to the
              shell.
            </p>
            <PixelButton onClick={() => window.location.reload()} tone="danger">
              RELOAD
            </PixelButton>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
