"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioPronto,
  inicializarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";

const TIMEOUT_INICIALIZACAO_MS = 10_000;

type Props = {
  children: React.ReactNode;
};

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [pronto, setPronto] = useState(() =>
    typeof window !== "undefined" ? armazenamentoLaboratorioPronto() : false
  );
  const [erro, setErro] = useState("");
  const prontoRef = useRef(pronto);

  useEffect(() => {
    prontoRef.current = pronto;
  }, [pronto]);

  useEffect(() => {
    let ativo = true;

    const liberar = (mensagemErro?: string) => {
      if (!ativo || prontoRef.current) return;
      prontoRef.current = true;
      if (mensagemErro) setErro(mensagemErro);
      setPronto(true);
    };

    if (armazenamentoLaboratorioPronto()) {
      liberar();
      return;
    }

    const timeout = window.setTimeout(() => {
      liberar(
        "O carregamento demorou mais que o esperado. A página será exibida com dados locais."
      );
    }, TIMEOUT_INICIALIZACAO_MS);

    const onPronto = () => liberar();
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);

    void inicializarArmazenamentoLaboratorio()
      .then(() => liberar())
      .catch(() =>
        liberar("Não foi possível carregar os dados do servidor. Recarregue a página.")
      )
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      ativo = false;
      window.clearTimeout(timeout);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    };
  }, []);

  if (!pronto) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500">
        Carregando dados do laboratório…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[12px] text-amber-800">
          {erro}
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
