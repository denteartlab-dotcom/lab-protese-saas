"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  LIMITE_CLIENTES_SERVICO_PAINEL,
  OPCOES_DIAS_SEM_SERVICO,
  ordenarClientesSemServicoPorMenosTempo,
  type ClienteSemServicoItem,
} from "@/lib/dashboard-clientes-servico";
import {
  abrirPdfGerandoComNomeNaUrl,
  nomeArquivoClientesSemServicoPdf,
  tituloAbaClientesSemServicoPdf,
} from "@/lib/pdf-viewer";
import { gerarClientesSemServicoPdf } from "@/lib/relatorio-clientes-sem-servico-pdf";
import { formatDate } from "@/lib/utils";

export function PainelClientesServicosDashboard({
  titulo,
  lista,
  diasMinimos,
  onDiasChange,
  carregarListaImpressao,
}: {
  titulo: string;
  lista: ClienteSemServicoItem[];
  diasMinimos: number;
  onDiasChange: (dias: number) => void;
  carregarListaImpressao?: () => Promise<ClienteSemServicoItem[]>;
}) {
  const { t } = useI18n();
  const [expandido, setExpandido] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  const opcoesDias = useMemo(
    () =>
      OPCOES_DIAS_SEM_SERVICO.map((op) => ({
        ...op,
        label: t("dashboard.diasN", { n: op.value }),
      })),
    [t]
  );

  useEffect(() => {
    setExpandido(false);
  }, [diasMinimos]);

  const ordenada = useMemo(
    () => ordenarClientesSemServicoPorMenosTempo(lista),
    [lista]
  );

  const visiveis = useMemo(
    () =>
      expandido
        ? ordenada
        : ordenada.slice(0, LIMITE_CLIENTES_SERVICO_PAINEL),
    [ordenada, expandido]
  );

  const temMais = ordenada.length > LIMITE_CLIENTES_SERVICO_PAINEL;

  async function imprimir() {
    if (imprimindo) return;
    setImprimindo(true);
    try {
      const bruta = carregarListaImpressao
        ? await carregarListaImpressao()
        : lista;
      const listaImpressao = ordenarClientesSemServicoPorMenosTempo(bruta);
      await abrirPdfGerandoComNomeNaUrl(
        () => gerarClientesSemServicoPdf(titulo, diasMinimos, listaImpressao),
        tituloAbaClientesSemServicoPdf(),
        nomeArquivoClientesSemServicoPdf()
      );
    } catch (err) {
      console.error("[clientes-sem-servico] imprimir", err);
      alert(
        err instanceof Error && err.message
          ? err.message
          : t("dashboard.relatorioErro")
      );
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        <select
          value={String(diasMinimos)}
          onChange={(e) => onDiasChange(Number(e.target.value))}
          className="h-6 max-w-[88px] rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-600"
          aria-label={t("dashboard.diasSemServico")}
        >
          {opcoesDias.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
      <div className="p-4">
        <p className="mb-3 text-[11px] text-slate-500">
          {t("dashboard.naoSolicitaServico", { dias: diasMinimos })}
        </p>
        <div className="mb-1 grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <span>{t("dashboard.cliente")}</span>
          <span>{t("dashboard.dataUltimo")}</span>
        </div>
        <div
          className={`space-y-0 overflow-y-auto ${
            expandido ? "max-h-52" : ""
          }`}
        >
          {visiveis.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-slate-400">
              {t("dashboard.nenhumClientePeriodo")}
            </p>
          ) : (
            visiveis.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-50 py-2 last:border-0"
              >
                <span className="truncate font-medium text-slate-700">
                  {c.nome}
                </span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {c.ultimoServicoEm ? formatDate(c.ultimoServicoEm) : "—"}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          {temMais ? (
            <button
              type="button"
              onClick={() => setExpandido((atual) => !atual)}
              className="rounded border border-primary-600 px-3 py-1 text-[11px] font-medium text-primary-600 hover:bg-primary-50"
            >
              {expandido ? t("dashboard.verMenos") : t("dashboard.verMais")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void imprimir()}
            disabled={imprimindo}
            className="rounded border border-primary-600 bg-primary-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {imprimindo ? t("dashboard.gerando") : t("dashboard.imprimir")}
          </button>
        </div>
      </div>
    </section>
  );
}
