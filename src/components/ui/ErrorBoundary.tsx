import { Component, type ReactNode } from 'react';
import { ErrorBlock } from './States';

/** Shows a friendly message instead of a blank page when a screen crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Moving to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4">
          <ErrorBlock
            message="This screen hit a problem. Your saved data is safe."
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
