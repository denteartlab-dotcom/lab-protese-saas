"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

type Props = {
  children: ReactNode;
};

type State = {
  erro: Error | null;
};

export class TvErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error) {
    console.error("[modulo-tv]", erro);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b12] p-6 text-slate-100">
        <div className="max-w-lg rounded-xl border border-red-500/30 bg-slate-900/90 p-6 text-center shadow-2xl">
          <h1 className="text-lg font-bold text-white">Erro ao abrir o Módulo TV</h1>
          <p className="mt-2 text-sm text-slate-400">
            O painel encontrou um problema ao carregar. Reinicie o servidor local com{" "}
            <strong className="text-slate-200">npm run dev</strong> e tente novamente.
          </p>
          <p className="mt-3 rounded-md bg-slate-950/80 px-3 py-2 font-mono text-xs text-red-300">
            {this.state.erro.message}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ erro: null })}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Tentar de novo
            </button>
            <Link
              href="/app"
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 transition hover:bg-blue-500/20"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
