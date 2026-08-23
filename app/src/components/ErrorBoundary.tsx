import { Component, type ReactNode } from "react";
import { NexoraAppIcon } from "./NexoraBrand";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-[100dvh] flex items-center justify-center bg-[#313338] p-4 select-none">
          <section className="w-full max-w-md rounded-xl bg-[#2B2D31] border border-black/20 p-8 shadow-[0_24px_64px_rgba(0,0,0,0.34)] text-center text-white">
            <NexoraAppIcon className="mx-auto mb-5 h-14 w-14" />
            <h1 className="text-2xl font-bold mb-2">
              Algo deu errado na Nexora
            </h1>
            <p className="text-[#B5BAC1] text-xs mb-4">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-[#B5BAC1] mt-4">
                <summary className="cursor-pointer mb-2">
                  Detalhes do erro
                </summary>
                <pre className="bg-[#313338] p-3 rounded-lg border border-white/5 overflow-auto max-h-64 whitespace-pre-wrap text-[11px]">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-sm rounded-md transition-colors"
            >
              Recarregar aplicação
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
