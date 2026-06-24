"use client";

import { useEffect, useState } from "react";
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

type EstadoBootstrap = "carregando" | "pronto" | "erro";

const TIMEOUT_CARREGAMENTO_MS = 20_000;

function avaliarBootstrap(): EstadoBootstrap {
  if (typeof window === "undefined") return "pronto";
  if (!armazenamentoLaboratorioPronto()) return "carregando";
  return armazenamentoLaboratorioBootstrapOk() ? "pronto" : "erro";
}

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [estado, setEstado] = useState<EstadoBootstrap>(avaliarBootstrap);
  const [erro, setErro] = useState("");
  const [tentando, setTentando] = useState(false);

  async function carregar(forcar = false) {
    setTentando(true);
    setErro("");
    setEstado("carregando");
    try {
      if (forcar) {
        await reinicializarArmazenamentoLaboratorio();
      } else {
        await inicializarArmazenamentoLaboratorio();
      }
      const ok = armazenamentoLaboratorioBootstrapOk();
      setEstado(ok ? "pronto" : "erro");
      if (!ok) {
        setErro(
          "Não foi possível carregar os dados do servidor. Verifique a conexão e tente novamente."
        );
      }
    } catch {
      setEstado("erro");
      setErro(
        "Não foi possível carregar os dados do servidor. Verifique a conexão e tente novamente."
      );
    } finally {
      setTentando(false);
    }
  }

  useEffect(() => {
    const atual = avaliarBootstrap();
    if (atual === "pronto") {
      setEstado("pronto");
      return;
    }

    const onPronto = () => {
      setEstado(armazenamentoLaboratorioBootstrapOk() ? "pronto" : "erro");
      if (!armazenamentoLaboratorioBootstrapOk()) {
        setErro(
          "Não foi possível carregar os dados do servidor. Verifique a conexão e tente novamente."
        );
      }
    };
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    void carregar();

    const timer = window.setTimeout(() => {
      setEstado((atualEstado) => {
        if (atualEstado !== "carregando") return atualEstado;
        setErro(
          "O carregamento demorou demais. Verifique se o servidor está online e tente novamente."
        );
        return "erro";
      });
    }, TIMEOUT_CARREGAMENTO_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    };
  }, []);

  if (estado === "carregando") {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center px-4">
        <p className="text-sm text-slate-500">Carregando dados do banco de dados…</p>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="max-w-md text-sm text-amber-900">{erro}</p>
        <button
          type="button"
          disabled={tentando}
          onClick={() => void carregar(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {tentando ? "Carregando…" : "Tentar novamente"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
