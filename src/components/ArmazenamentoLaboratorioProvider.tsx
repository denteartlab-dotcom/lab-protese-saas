"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { TIMEOUT_CARREGAMENTO_APP_MS } from "@/lib/dev-timeouts";

type Props = {
  children: React.ReactNode;
};

type EstadoBootstrap = "carregando" | "pronto" | "erro";

const BUILD_ID_ATUAL = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "dev";

function rotaSemArmazenamentoLaboratorio(pathname: string) {
  return pathname.includes("/visualizar-pdf");
}

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
  const pathname = usePathname();
  const ignoraBootstrap = rotaSemArmazenamentoLaboratorio(pathname);
  const [estado, setEstado] = useState<EstadoBootstrap>("carregando");
  const [erro, setErro] = useState("");
  const [tentando, setTentando] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

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
    if (ignoraBootstrap) {
      setEstado("pronto");
      return;
    }

    let cancelado = false;
    let timer: number | undefined;
    let onPronto: (() => void) | undefined;

    void (async () => {
      if (typeof window !== "undefined") {
        const host = window.location.hostname.toLowerCase();
        const pathComQuery = `${window.location.pathname}${window.location.search}`;
        if (host === "denteartlab.com.br") {
          const proto = window.location.protocol;
          window.location.replace(`${proto}//www.denteartlab.com.br${pathComQuery}`);
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
      }, TIMEOUT_CARREGAMENTO_APP_MS);
    })();

    return () => {
      cancelado = true;
      if (timer) window.clearTimeout(timer);
      if (onPronto) {
        window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
      }
    };
  }, [ignoraBootstrap]);

  const mostrarCarregando = montado && !ignoraBootstrap && estado === "carregando";
  const mostrarErro = montado && !ignoraBootstrap && estado === "erro";

  return (
    <>
      {children}
      {mostrarCarregando ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#f4f6f8]/95 px-4 dark:bg-slate-950/95">
          <p className="text-center text-sm text-slate-500">
            Carregando dados do banco de dados…
            {process.env.NODE_ENV === "development" ? (
              <span className="mt-1 block text-xs text-slate-400">
                Na primeira vez após iniciar o servidor, isso pode levar até 1 minuto.
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
      {mostrarErro ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[#f4f6f8]/95 px-4 text-center dark:bg-slate-950/95">
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
      ) : null}
    </>
  );
}
