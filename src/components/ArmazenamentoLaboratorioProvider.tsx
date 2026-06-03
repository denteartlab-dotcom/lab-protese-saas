"use client";

import { useEffect, useState } from "react";
import { inicializarArmazenamentoLaboratorio } from "@/lib/armazenamento-laboratorio";

type Props = {
  children: React.ReactNode;
};

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void inicializarArmazenamentoLaboratorio()
      .then(() => {
        if (ativo) setPronto(true);
      })
      .catch(() => {
        if (ativo) {
          setErro("Não foi possível carregar os dados do servidor. Recarregue a página.");
          setPronto(true);
        }
      });
    return () => {
      ativo = false;
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
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-red-600">
        <p>{erro}</p>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
