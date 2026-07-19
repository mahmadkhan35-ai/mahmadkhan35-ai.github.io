import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Chessforge]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            margin: '2rem auto',
            maxWidth: 40 * 16,
            padding: '1.5rem',
            color: '#e8edd8',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.4rem' }}>Не удалось загрузить Chessforge</h1>
          <p style={{ opacity: 0.85 }}>{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
            }}
          >
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
