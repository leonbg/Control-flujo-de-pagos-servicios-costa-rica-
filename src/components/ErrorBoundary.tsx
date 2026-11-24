import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Error inesperado en la aplicación.',
    };
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.message.includes('Quota exceeded');
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
            <h1 className="text-lg font-semibold text-slate-900">
              {isQuotaError
                ? 'Límite diario de base de datos alcanzado'
                : 'Algo salió mal al cargar la vista'}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {isQuotaError
                ? 'Se alcanzó la cuota diaria gratuita de Firestore. La cuota se restablecerá mañana automáticamente.'
                : 'Tus datos guardados permanecen intactos. Intenta recargar la página para continuar.'}
            </p>
            <p className="mt-3 text-xs font-mono text-slate-500 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
