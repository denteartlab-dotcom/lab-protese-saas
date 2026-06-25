"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioBootstrapOk,
  armazenamentoLaboratorioPronto,
  armazenamentoLaboratorioSessaoExpirada,
  inicializarArmazenamentoLaboratorio,
  reinicializarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";
import {
  executarRecuperacaoAutomatica,
  garantirVersaoAplicacaoAtual,
} from "@/lib/app-cache-recovery";

type Props = {
  children: React.ReactNode;
};

type EstadoBootstrap = "carregando" | "pronto" | "erro";

const TIMEOUT_CARREGAMENTO_MS = 20_000;
const BUILD_ID_ATUAL = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "dev";

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
      if (!ok) {
        const recuperou = await executarRecuperacaoAutomatica();
        if (recuperou) return;
      }
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
    let cancelado = false;
    let timer: number | undefined;
    let onPronto: (() => void) | undefined;

    void (async () => {
      if (typeof window !== "undefined") {
        const host = window.location.hostname.toLowerCase();
        if (host === "denteartlab.com.br") {
          window.location.replace(
            `https://www.denteartlab.com.br${window.location.pathname}${window.location.search}`
          );
          return;
        }

        const recarregou = await garantirVersaoAplicacaoAtual(BUILD_ID_ATUAL);
        if (recarregou) return;
      }

      if (cancelado) return;

      const atual = avaliarBootstrap();
      if (atual === "pronto") {
        setEstado("pronto");
        return;
      }

      onPronto = () => {
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

      timer = window.setTimeout(() => {
        void (async () => {
          const recuperou = await executarRecuperacaoAutomatica();
          if (recuperou || cancelado) return;
          setEstado((atualEstado) => {
            if (atualEstado !== "carregando") return atualEstado;
            setErro(
              "O carregamento demorou demais. Limpe o cache do navegador ou tente novamente."
            );
            return "erro";
          });
        })();
      }, TIMEOUT_CARREGAMENTO_MS);
    })();

    return () => {
      cancelado = true;
      if (timer) window.clearTimeout(timer);
      if (onPronto) {
        window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
      }
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
        <Link
          href="/limpar-sessao"
          className="text-sm text-primary-700 underline hover:text-primary-800"
        >
          Limpar cache do navegador e entrar de novo
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
