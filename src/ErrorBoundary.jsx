import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24,
          fontFamily: 'sans-serif',
          maxWidth: 600,
          margin: '40px auto',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 8,
        }}>
          <h2 style={{ margin: '0 0 12px 0', color: '#856404' }}>Something went wrong</h2>
          <pre style={{ overflow: 'auto', fontSize: 12 }}>{this.state.error?.message}</pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '8px 16px', marginTop: 12, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
