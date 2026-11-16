import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NERO Uncaught UI Exception:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#0a0a0f] text-nero-text flex flex-col items-center justify-center p-8 select-none">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <span className="text-red-400 font-mono text-2xl font-bold">!</span>
          </div>

          <h1 className="text-xl font-bold font-mono tracking-tight text-nero-text mb-2">
            Application Recovery Shield
          </h1>

          <p className="text-xs text-nero-muted text-center max-w-md mb-6 leading-relaxed">
            NERO caught an unexpected interface exception. Your underlying persistent memory,
            databases, and AI sessions remain safe.
          </p>

          {this.state.error && (
            <div className="max-w-xl w-full p-4 rounded-xl bg-black/60 border border-white/5 mb-6 text-left">
              <span className="text-[10px] font-mono uppercase text-red-400 block mb-1">
                Exception Diagnostics
              </span>
              <pre className="text-xs font-mono text-nero-muted overflow-x-auto whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#/';
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors shadow-lg"
            >
              Reload Interface
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#/';
              }}
              className="px-5 py-2.5 rounded-xl bg-white/5 text-nero-text border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Reset to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
