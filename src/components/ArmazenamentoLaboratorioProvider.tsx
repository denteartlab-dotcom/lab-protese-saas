"use client";

import { useEffect, useState } from "react";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioBootstrapOk,
  armazenamentoLaboratorioPronto,
  armazenamentoLaboratorioSessaoExpirada,
  inicializarArmazenamentoLaboratorio,
  reinicializarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";

type Props = {
  children: React.ReactNode;
};

type EstadoBootstrap = "carregando" | "pronto" | "erro";

const TIMEOUT_CARREGAMENTO_MS = 20_000;

function avaliarBootstrap(): EstadoBootstrap {
  if (typeof window === "undefined") return "carregando";
  if (!armazenamentoLaboratorioPronto()) return "carregando";
  return armazenamentoLaboratorioBootstrapOk() ? "pronto" : "erro";
}

function redirecionarParaLogin() {
  const redirect = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
}

export function ArmazenamentoLaboratorioProvider({ children }: Props) {
  const [estado, setEstado] = useState<EstadoBootstrap>("carregando");
  const [erro, setErro] = useState("");
  const [tentando, setTentando] = useState(false);

  async function carregar(forcar = false) {
    setTentando(true);
    setErro("");
    setEstado("carregando");
    try {
      const precisaReinicializar =
        forcar ||
        (armazenamentoLaboratorioPronto() && !armazenamentoLaboratorioBootstrapOk());
      if (precisaReinicializar) {
        await reinicializarArmazenamentoLaboratorio();
      } else {
        await inicializarArmazenamentoLaboratorio();
      }

      if (armazenamentoLaboratorioSessaoExpirada()) {
        redirecionarParaLogin();
        return;
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
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host === "denteartlab.com.br") {
        window.location.replace(
          `https://www.denteartlab.com.br${window.location.pathname}${window.location.search}`
        );
        return;
      }
    }

    const atual = avaliarBootstrap();
    if (atual === "pronto") {
      setEstado("pronto");
      return;
    }

    const onPronto = () => {
      if (armazenamentoLaboratorioSessaoExpirada()) {
        redirecionarParaLogin();
        return;
      }
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
