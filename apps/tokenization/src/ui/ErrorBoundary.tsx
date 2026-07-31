/**
 * Minimal app-level error boundary. Without one, an unexpected render error blanks
 * the whole page. This shows a friendly message instead; the raw error goes to the
 * console only, never to the screen.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] render error', error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Something went wrong.</h1>
        <p style={{ margin: 0, maxWidth: 480, lineHeight: 1.6 }}>
          This page hit an unexpected error. Please reload to try again.
        </p>
      </div>
    );
  }
}
