import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { PlayerError } from './Players/PlayerError';

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Video player error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <PlayerError message="This stream could not be loaded." onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
