"use client";

import { useEffect, useState } from "react";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioBootstrapOk,
  inicializarArmazenamentoLaboratorio,
  reinicializarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";

type Props = {
  children: React.ReactNode;
};

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [bootstrapOk, setBootstrapOk] = useState(() =>
    typeof window !== "undefined" ? armazenamentoLaboratorioBootstrapOk() : true
  );
  const [erro, setErro] = useState("");
  const [tentando, setTentando] = useState(false);

  async function carregar(forcar = false) {
    setTentando(true);
    setErro("");
    try {
      if (forcar) {
        await reinicializarArmazenamentoLaboratorio();
      } else {
        await inicializarArmazenamentoLaboratorio();
      }
      const ok = armazenamentoLaboratorioBootstrapOk();
      setBootstrapOk(ok);
      if (!ok) {
        setErro(
          "Não foi possível carregar os dados do servidor. Verifique a conexão e tente novamente."
        );
      }
    } catch {
      setErro(
        "Não foi possível carregar os dados do servidor. Verifique a conexão e tente novamente."
      );
    } finally {
      setTentando(false);
    }
  }

  useEffect(() => {
    if (armazenamentoLaboratorioBootstrapOk()) {
      setBootstrapOk(true);
      return;
    }

    const onPronto = () => {
      setBootstrapOk(armazenamentoLaboratorioBootstrapOk());
    };
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    void carregar();

    return () => {
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    };
  }, []);

  return (
    <>
      {!bootstrapOk && erro ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          {erro}{" "}
          <button
            type="button"
            disabled={tentando}
            onClick={() => void carregar(true)}
            className="font-semibold underline disabled:opacity-60"
          >
            {tentando ? "Carregando…" : "Tentar novamente"}
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
