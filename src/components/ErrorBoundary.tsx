import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  slotId?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Video Player Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            Playback Error
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {this.props.slotId !== undefined ? `Slot ${this.props.slotId + 1}: ` : ''}
            Unable to load video player
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--accent-red)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
