"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { CampoDataBr } from "@/components/campo-data-br";
import { RelatorioCabecalho, RelatorioTituloLateral } from "@/components/relatorios/RelatorioCabecalho";
import { SelectPesquisavel } from "@/components/SelectPesquisavel";
import { ImprimirReciboModal } from "@/components/financeiro/ImprimirReciboModal";
import { PainelCarregando } from "@/components/ListaCarregando";
import { dateToBrShort } from "@/lib/datas-br";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarRelatorioRecibosEmitidosPdf } from "@/lib/recibos-emitidos-pdf";
import {
  coletarClientesRecibosEmitidos,
  exportarRecibosEmitidosCsv,
  filtrarRecibosEmitidos,
  moneyRecibosEmitidos,
  type LancamentoReciboEmitido,
  type LinhaReciboEmitido,
} from "@/lib/recibos-emitidos";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280] dark:text-slate-400";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-[12px] text-[#374151] dark:text-slate-200 outline-none focus:border-[#4a90d9]";

const inputDataRelatorioClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 text-[12px] text-[#374151] dark:text-slate-200 shadow-none focus:border-[#4a90d9] focus:ring-0";

const thClass =
  "px-3 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide";
const tdClass = "px-3 py-2.5 text-center align-middle text-[#374151] dark:text-slate-200";

function primeiroDiaMesBr() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
}

export function RelatorioRecibosEmitidosConteudo() {
  const { t } = useI18n();
  const [carregando, setCarregando] = useState(true);
  const [lancamentos, setLancamentos] = useState<LancamentoReciboEmitido[]>([]);
  const [clienteId, setClienteId] = useState("todos");
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesBr);
  const [dataFim, setDataFim] = useState(() => dateToBrShort(new Date()));
  const [gerado, setGerado] = useState(false);
  const [linhasExibidas, setLinhasExibidas] = useState<LinhaReciboEmitido[]>([]);
  const [reciboImpressao, setReciboImpressao] = useState<{
    clienteNome: string;
    linhas: LinhaReciboEmitido["linhaRecibo"][];
  } | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro", { cache: "no-store" });
      const data = res.ok ? await res.json() : { lancamentos: [] };
      const lista = Array.isArray(data?.lancamentos) ? data.lancamentos : [];
      setLancamentos(lista as LancamentoReciboEmitido[]);
    } catch {
      setLancamentos([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setCarregando(true);
      await recarregar();
      setCarregando(false);
    })();
    const atualizar = () => void recarregar();
    window.addEventListener("focus", atualizar);
    return () => window.removeEventListener("focus", atualizar);
  }, [recarregar]);

  const opcoesCliente = useMemo(
    () => coletarClientesRecibosEmitidos(lancamentos),
    [lancamentos]
  );

  function gerarRelatorio() {
    const linhas = filtrarRecibosEmitidos(lancamentos, {
      clienteId,
      dataInicio,
      dataFim,
    });
    setLinhasExibidas(linhas);
    setGerado(true);
  }

  function linhasParaPdf() {
    return gerado
      ? linhasExibidas
      : filtrarRecibosEmitidos(lancamentos, { clienteId, dataInicio, dataFim });
  }

  function imprimir() {
    const linhas = linhasParaPdf();
    if (!gerado) {
      setLinhasExibidas(linhas);
      setGerado(true);
    }
    void abrirPdfGerando(
      () => gerarRelatorioRecibosEmitidosPdf(linhas, dataInicio, dataFim),
      "recibos-emitidos.pdf"
    );
  }

  function exportarExcel() {
    const linhas = gerado
      ? linhasExibidas
      : filtrarRecibosEmitidos(lancamentos, { clienteId, dataInicio, dataFim });
    exportarRecibosEmitidosCsv(linhas);
  }

  function abrirReciboLinha(linha: LinhaReciboEmitido) {
    setReciboImpressao({
      clienteNome: linha.clienteNome,
      linhas: [linha.linhaRecibo],
    });
  }

  if (carregando) {
    return (
      <div className="min-h-[320px] bg-[#f3f4f6] dark:bg-slate-950 pb-8 pt-1">
        <PainelCarregando mensagem={t("relatorio.carregandoRecibos")} />
      </div>
    );
  }

  return (
    <div className="relatorio-recibos-emitidos bg-[#f3f4f6] dark:bg-slate-950 pb-8 pt-1 text-[12px] text-[#374151] dark:text-slate-200 print:bg-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <RelatorioTituloLateral />
        <RelatorioCabecalho labelKey="nav.relatorio.recibosEmitidos" className="mb-0" />
      </div>

      <div id="relatorio-recibos-emitidos-impressao" className="space-y-4 print:space-y-3">
        <div className="overflow-visible rounded-sm border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm print:hidden">
          <div className="space-y-3 px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <SelectPesquisavel
                  label={t("relatorio.comum.cliente")}
                  value={clienteId}
                  onChange={setClienteId}
                  placeholder={t("relatorio.opcao.todos")}
                  inputClassName={selectClass}
                  options={[
                    { value: "todos", label: t("relatorio.opcao.todos") },
                    ...opcoesCliente.map((c) => ({ value: c.id, label: c.nome })),
                  ]}
                />
              </div>
              <div>
                <label className={labelClass}>{t("relatorio.recibos.dataRecebimento")}</label>
                <div className="flex items-center gap-2">
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                  <CampoDataBr
                    value={dataFim}
                    onChange={setDataFim}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={gerarRelatorio}
                className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#5cb85c] px-4 text-[12px] font-semibold text-white hover:bg-[#4cae4c]"
              >
                <FileText className="h-4 w-4" />
                {t("relatorio.gerarRelatorio")}
              </button>
              <button
                type="button"
                onClick={imprimir}
                className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#4a90d9] px-4 text-[12px] font-semibold text-white hover:bg-[#3d7fc4]"
              >
                <Printer className="h-4 w-4" />
                {t("relatorio.imprimir")}
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-sm bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
                title={t("relatorio.excel")}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm print:border-0 print:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-[12px]">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[42%]" />
                <col className="w-[22%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f3f4f6] dark:bg-slate-950 text-[#6b7280] dark:text-slate-400">
                  <th className={thClass}>{t("relatorio.comum.data")}</th>
                  <th className={thClass}>{t("relatorio.comum.cliente")}</th>
                  <th className={thClass}>{t("relatorio.comum.valor")}</th>
                  <th className={thClass}>{t("relatorio.recibos.colunaOpcoes")}</th>
                </tr>
              </thead>
              <tbody>
                {!gerado ? (
                  <tr>
                    <td colSpan={4} className="h-[280px] text-center text-[#9ca3af] dark:text-slate-500">
                      {t("relatorio.gerarRelatorioHint")}
                    </td>
                  </tr>
                ) : linhasExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-[280px] text-center text-[#9ca3af] dark:text-slate-500">
                      {t("relatorio.recibos.semRecibos")}
                    </td>
                  </tr>
                ) : (
                  linhasExibidas.map((linha) => (
                    <tr
                      key={linha.id}
                      className="border-b border-[#f3f4f6] transition-colors hover:bg-[#eef2ff] dark:bg-slate-800 print:hover:bg-transparent"
                    >
                      <td className={cn(tdClass, "whitespace-nowrap")}>{linha.dataLabel}</td>
                      <td className={cn(tdClass, "text-left")}>{linha.clienteNome}</td>
                      <td className={cn(tdClass, "tabular-nums font-semibold text-[#2563eb]")}>
                        {moneyRecibosEmitidos(linha.valor)}
                      </td>
                      <td className={tdClass}>
                        <button
                          type="button"
                          title={t("relatorio.recibos.imprimirRecibo")}
                          onClick={() => abrirReciboLinha(linha)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-[#4a90d9] hover:bg-[#eef2ff] dark:bg-slate-800 print:hidden"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ImprimirReciboModal
        open={Boolean(reciboImpressao)}
        onClose={() => setReciboImpressao(null)}
        clienteNome={reciboImpressao?.clienteNome ?? ""}
        linhas={reciboImpressao?.linhas ?? []}
      />

    </div>
  );
}
