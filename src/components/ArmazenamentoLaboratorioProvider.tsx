"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioBootstrapOk,
  armazenamentoLaboratorioPronto,
  inicializarArmazenamentoLaboratorio,
  reinicializarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";

type Props = {
  children: React.ReactNode;
};

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [pronto, setPronto] = useState(() =>
    typeof window !== "undefined" ? armazenamentoLaboratorioPronto() : false
  );
  const [bootstrapOk, setBootstrapOk] = useState(() =>
    typeof window !== "undefined" ? armazenamentoLaboratorioBootstrapOk() : false
  );
  const [erro, setErro] = useState("");
  const [tentando, setTentando] = useState(false);
  const prontoRef = useRef(pronto);

  useEffect(() => {
    prontoRef.current = pronto;
  }, [pronto]);

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
      setPronto(true);
    } catch {
      setErro(
        "Não foi possível carregar os dados do servidor. Verifique a conexão e tente novamente."
      );
      setPronto(true);
    } finally {
      setTentando(false);
    }
  }

  useEffect(() => {
    if (armazenamentoLaboratorioPronto()) {
      setPronto(true);
      setBootstrapOk(armazenamentoLaboratorioBootstrapOk());
      return;
    }

    const onPronto = () => {
      setPronto(true);
      setBootstrapOk(armazenamentoLaboratorioBootstrapOk());
    };
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    void carregar();

    return () => {
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

  if (!bootstrapOk) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center text-sm text-slate-600">
        <p>{erro || "Não foi possível carregar os dados do servidor."}</p>
        <button
          type="button"
          disabled={tentando}
          onClick={() => void carregar(true)}
          className="rounded-sm bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {tentando ? "Carregando…" : "Tentar novamente"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
