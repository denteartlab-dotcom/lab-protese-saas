"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FaturaPdfViewer } from "@/components/financeiro/FaturaPdfViewer";
import {
  lerFaturaImpressaoSessao,
  type FaturaImpressaoSessao,
} from "@/lib/fatura-impressao-sessao";

function ImprimirFaturaConteudo() {
  const params = useSearchParams();
  const id = params.get("id")?.trim() ?? "";
  const imprimir = params.get("imprimir") === "1";
  const [payload, setPayload] = useState<FaturaImpressaoSessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) {
      setPayload(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const dados = lerFaturaImpressaoSessao(id);
    setPayload(dados);
    setCarregando(false);
  }, [id]);

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
        Carregando fatura...
      </div>
    );
  }

  if (!id || !payload) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <p className="text-sm font-medium text-red-300">
          Não foi possível abrir a fatura para impressão.
        </p>
        <p className="text-xs text-slate-300">
          Feche esta aba e tente novamente pelo financeiro.
        </p>
      </div>
    );
  }

  return (
    <FaturaPdfViewer
      {...payload}
      imprimirAoCarregar={imprimir || Boolean(payload.imprimirAoCarregar)}
    />
  );
}

export default function ImprimirFaturaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Carregando visualizador...
        </div>
      }
    >
      <ImprimirFaturaConteudo />
    </Suspense>
  );
}
