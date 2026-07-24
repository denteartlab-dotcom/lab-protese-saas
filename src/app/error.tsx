"use client";

import { useEffect } from "react";

/**
 * Evita tela branca de 500 ao reabrir o navegador com cookie/sessão inválida.
 * Oferece recuperação automática via /limpar-sessao.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-800">
        Não foi possível carregar o sistema
      </h1>
      <p className="max-w-md text-sm text-slate-600">
        Isso costuma acontecer quando a sessão do navegador ficou inválida após
        fechar e abrir o Chrome. Limpe a sessão para voltar ao login.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/limpar-sessao"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Limpar sessão e abrir login
        </a>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
