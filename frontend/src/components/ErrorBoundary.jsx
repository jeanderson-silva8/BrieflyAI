import { Component } from 'react';

/**
 * React Error Boundary — captura erros de renderização para evitar
 * que stack traces / detalhes técnicos cheguem até o usuário.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, requestId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true, requestId: crypto.randomUUID() };
  }

  componentDidCatch(error, info) {
    // Em produção, idealmente enviar para Sentry/monitoring.
    // Aqui apenas log local para não vazar nada visualmente.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, requestId: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: '#0a0a0f',
        color: '#E8E8F0',
        fontFamily: 'Inter, -apple-system, sans-serif',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Algo deu errado</h1>
        <p style={{ color: '#8888A0', maxWidth: 420 }}>
          Encontramos um problema inesperado. Sua sessão está segura — basta recarregar.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            padding: '12px 28px',
            background: 'linear-gradient(135deg,#6C63FF 0%,#00D9FF 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Recarregar
        </button>
        {this.state.requestId && (
          <small style={{ color: '#55556A', fontSize: 11 }}>
            ref: {this.state.requestId}
          </small>
        )}
      </div>
    );
  }
}
