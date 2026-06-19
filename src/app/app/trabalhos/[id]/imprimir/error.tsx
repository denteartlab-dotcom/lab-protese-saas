"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function ImprimirOSError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("imprimir OS (error boundary)", error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-xl rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
      <p className="font-semibold">Erro ao abrir a impressão.</p>
      <p className="mt-2 text-sm">
        Ocorreu uma falha ao preparar a requisição. Atualize a página (Ctrl+F5) e tente
        novamente.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-red-500">Referência: {error.digest}</p>
      ) : null}
      <div className="mt-4 flex justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Tentar novamente
        </Button>
        <Button type="button" variant="outline" onClick={() => window.close()}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
