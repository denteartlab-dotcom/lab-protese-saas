"use client";

import { useEffect, useRef, useState } from "react";
import { inicializarArmazenamentoLaboratorio } from "@/lib/armazenamento-laboratorio";

const TIMEOUT_INICIALIZACAO_MS = 25_000;

type Props = {
  children: React.ReactNode;
};

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");
  const prontoRef = useRef(false);

  useEffect(() => {
    let ativo = true;

    const timeout = window.setTimeout(() => {
      if (!ativo || prontoRef.current) return;
      setErro(
        "O carregamento demorou mais que o esperado. A página será exibida com dados locais."
      );
      prontoRef.current = true;
      setPronto(true);
    }, TIMEOUT_INICIALIZACAO_MS);

    void inicializarArmazenamentoLaboratorio()
      .then(() => {
        if (!ativo || prontoRef.current) return;
        prontoRef.current = true;
        setPronto(true);
      })
      .catch(() => {
        if (!ativo || prontoRef.current) return;
        setErro("Não foi possível carregar os dados do servidor. Recarregue a página.");
        prontoRef.current = true;
        setPronto(true);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      ativo = false;
      window.clearTimeout(timeout);
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
