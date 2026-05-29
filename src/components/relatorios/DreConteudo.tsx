"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Home, Printer, X } from "lucide-react";
import { DreGraficos } from "@/components/relatorios/DreGraficos";
import { ImprimirDreModal } from "@/components/relatorios/ImprimirDreModal";
import { cn } from "@/lib/utils";
import {
  calcularIndicativosDre,
  corValorIndicativo,
  formatarValorIndicativo,
} from "@/lib/dre-graficos";
import {
  calcularMatrizDre,
  exportarDreCsv,
  lancamentosDrilldownDre,
  MESES_DRE,
  type DreLinha,
  type DreLinhaId,
  type DreEstiloLinha,
  type LancamentoDre,
} from "@/lib/dre";
import { carregarPlanoContas } from "@/lib/plano-contas";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { visualizarPdfUrl } from "@/lib/pdf-viewer";

const LINHAS_CLICAVEIS = new Set<DreLinhaId>([
  "receita_bruta",
  "impostos",
  "custos_fixos",
  "custos_variaveis",
  "despesas",
  "despesas_nao_operacionais",
  "irpj_csll",
]);

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const selectClass =
  "h-[34px] w-[120px] rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Linhas cujo valor (meses) é verde — totais/resultados. Demais: azul. */
const LINHAS_VALOR_VERDE = new Set<DreLinhaId>([
  "receita_liquida",
  "resultado_operacional",
  "lair",
  "lucro_liquido",
]);

const celulaBase = {
  borderBottom: "1px solid #eeeeee",
} as const;

/** Fundo colorido só na 1ª coluna (nome da conta). */
function estiloColunaLabel(estilo: DreEstiloLinha, ehLucro: boolean) {
  if (ehLucro) {
    return {
      ...celulaBase,
      backgroundColor: "#1e3a5f",
      color: "#ffffff",
      fontWeight: "700",
      paddingTop: "14px",
      paddingBottom: "14px",
    };
  }
  if (estilo === "receita") {
    return {
      ...celulaBase,
      backgroundColor: "#e8f5e9",
      color: "#2e7d32",
      fontWeight: "500",
      paddingTop: "12px",
      paddingBottom: "12px",
    };
  }
  if (estilo === "deducao") {
    return {
      ...celulaBase,
      backgroundColor: "#ffebee",
      color: "#374151",
      fontWeight: "500",
      paddingTop: "12px",
      paddingBottom: "12px",
    };
  }
  return {
    ...celulaBase,
    backgroundColor: "#ffffff",
    color: "#374151",
    fontWeight: "500",
    paddingTop: "12px",
    paddingBottom: "12px",
  };
}

/** Células dos meses: fundo branco; só Lucro Líquido pinta a linha inteira. */
function estiloColunaValor(ehLucro: boolean) {
  if (ehLucro) {
    return {
      ...celulaBase,
      backgroundColor: "#1e3a5f",
      paddingTop: "14px",
      paddingBottom: "14px",
    };
  }
  return {
    ...celulaBase,
    backgroundColor: "#ffffff",
    paddingTop: "12px",
    paddingBottom: "12px",
  };
}

function corTextoValor(linhaId: DreLinhaId, ehLucro: boolean) {
  if (ehLucro) return "#ffffff";
  if (LINHAS_VALOR_VERDE.has(linhaId)) return "#2e7d32";
  return "#4a90d9";
}

const btnCelulaClass =
  "m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-right text-[12px] hover:underline print:no-underline";

const estiloLabelIndicativo = {
  backgroundColor: "#e0f7fa",
  color: "#374151",
  fontWeight: "500",
  borderBottom: "1px solid #eeeeee",
  borderTop: "1px solid #b2ebf2",
  paddingTop: "12px",
  paddingBottom: "12px",
} as const;

const estiloValorIndicativo = {
  backgroundColor: "#ffffff",
  borderBottom: "1px solid #eeeeee",
  paddingTop: "12px",
  paddingBottom: "12px",
} as const;

type DrilldownState = {
  mesIndex: number;
  linhaId?: DreLinhaId;
  titulo: string;
};

export function DreConteudo() {
  const [lancamentos, setLancamentos] = useState<LancamentoDre[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [aba, setAba] = useState<"tabela" | "graficos">("tabela");
  const [indicativosVisiveis, setIndicativosVisiveis] = useState(false);
  const [imprimirModalAberto, setImprimirModalAberto] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [planoContas, setPlanoContas] = useState(carregarPlanoContas());

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear();
    return [atual - 2, atual - 1, atual, atual + 1];
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/financeiro", { cache: "no-store" });
      const data = await res.json();
      setLancamentos(Array.isArray(data.lancamentos) ? data.lancamentos : []);
      setPlanoContas(carregarPlanoContas());
    } catch {
      setLancamentos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const onPlano = () => setPlanoContas(carregarPlanoContas());
    window.addEventListener("labProtesePlanoContasAtualizado", onPlano);
    return () => window.removeEventListener("labProtesePlanoContasAtualizado", onPlano);
  }, [recarregar]);

  const matriz = useMemo(
    () => calcularMatrizDre(lancamentos, ano, planoContas),
    [lancamentos, ano, planoContas]
  );

  const linhasIndicativos = useMemo(() => calcularIndicativosDre(matriz), [matriz]);

  const lancamentosDrill = useMemo(() => {
    if (!drilldown) return [];
    if (drilldown.linhaId) {
      return lancamentosDrilldownDre(
        lancamentos,
        ano,
        drilldown.mesIndex,
        drilldown.linhaId,
        planoContas
      );
    }
    return lancamentos.filter((l) => {
      if (l.status === "cancelado") return false;
      const d = new Date(l.data);
      return d.getFullYear() === ano && d.getMonth() === drilldown.mesIndex;
    });
  }, [drilldown, lancamentos, ano, planoContas]);

  function abrirDrilldownMes(mesIndex: number) {
    setDrilldown({
      mesIndex,
      titulo: `Lançamentos — ${MESES_DRE[mesIndex]} / ${ano}`,
    });
  }

  function abrirDrilldownCelula(linha: DreLinha, mesIndex: number) {
    if (!LINHAS_CLICAVEIS.has(linha.id)) return;
    setDrilldown({
      mesIndex,
      linhaId: linha.id,
      titulo: `${linha.label} — ${MESES_DRE[mesIndex]} / ${ano}`,
    });
  }

  function abrirPdfViewer(url: string, titulo: string, janela?: Window | null) {
    const nome = `${titulo.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    visualizarPdfUrl(url, nome, titulo, { janela });
    setImprimirModalAberto(false);
  }

  function exportarExcel() {
    const csv = exportarDreCsv(matriz);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dre-relatorio -mx-1 pb-4 text-[12px] text-[#374151] sm:mx-0">
      <div className="mb-4 flex items-center gap-1.5 text-[#6b7280]">
        <Home className="h-3.5 w-3.5 shrink-0" />
        <Link href="/app/relatorios" className="hover:text-[#4a90d9]">
          Relatórios
        </Link>
        <span className="text-[#9ca3af]">/</span>
        <span className="font-medium text-[#374151]">DRE</span>
      </div>

      <div className="overflow-hidden border border-[#e5e7eb] bg-white">
        <div className="flex flex-col print:hidden sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-5 sm:pt-5">
          <div className="px-5 pt-5 sm:px-0 sm:pt-0">
            <label className={labelClass}>Período</label>
            <select
              className={selectClass}
              value={String(ano)}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {anosDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <div className="mt-4 flex border-b border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setAba("tabela")}
                className={cn(
                  "border-b-2 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors",
                  aba === "tabela"
                    ? "border-[#4a90d9] text-[#4a90d9]"
                    : "border-transparent text-[#6b7280] hover:text-[#374151]"
                )}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setAba("graficos")}
                className={cn(
                  "border-b-2 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors",
                  aba === "graficos"
                    ? "border-[#4a90d9] text-[#4a90d9]"
                    : "border-transparent text-[#6b7280] hover:text-[#374151]"
                )}
              >
                Gráficos
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start px-5 pb-3 pt-0 sm:mt-[18px] sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={() => setIndicativosVisiveis((v) => !v)}
              className={cn(
                "h-[34px] rounded-sm border px-4 text-[12px] font-medium transition-colors",
                indicativosVisiveis
                  ? "border-[#4a90d9] bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
                  : "border-[#7ec8e3] bg-[#e8f4fc] text-[#2563eb] hover:bg-[#dbeafe]"
              )}
            >
              Indicativos
            </button>
            <button
              type="button"
              onClick={() => setImprimirModalAberto(true)}
              className="flex h-[34px] items-center gap-2 rounded-sm bg-[#4a90d9] px-4 text-[12px] font-medium text-white hover:bg-[#3d7fc4]"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              title="Exportar Excel"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#22c55e] text-white hover:bg-[#16a34a]"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
          </div>
        </div>

        {aba === "tabela" ? (
          <>
            <div className="overflow-x-auto">
              <table className="dre-tabela w-full min-w-[1100px] table-fixed border-collapse">
                <colgroup>
                  <col className="w-[26%]" />
                  {MESES_DRE.map((mes) => (
                    <col key={mes} className="w-[6.16%]" />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      style={{ backgroundColor: "#f3f4f6" }}
                      className="border-b border-[#e5e7eb] py-3 pl-5 pr-2"
                    />
                    {MESES_DRE.map((mes, mesIndex) => (
                      <th
                        key={mes}
                        style={{ backgroundColor: "#f3f4f6" }}
                        className="border-b border-[#e5e7eb] px-1 py-3 text-center text-[11px] font-semibold uppercase tracking-wide"
                      >
                        <button
                          type="button"
                          onClick={() => abrirDrilldownMes(mesIndex)}
                          className="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold uppercase tracking-wide text-[#4a90d9] hover:underline print:no-underline"
                        >
                          {mes}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carregando ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="bg-white py-16 text-center text-[#9ca3af]"
                      >
                        Carregando...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {matriz.linhas.map((linha) => {
                        const ehLucro = linha.id === "lucro_liquido";
                        const clicavel = LINHAS_CLICAVEIS.has(linha.id);
                        const corValor = corTextoValor(linha.id, ehLucro);
                        return (
                          <tr key={linha.id}>
                            <td
                              style={estiloColunaLabel(linha.estilo, ehLucro)}
                              className="pl-5 pr-3 text-left text-[12px]"
                            >
                              {linha.label}
                            </td>
                            {linha.valores.map((valor, mesIndex) => (
                              <td
                                key={`${linha.id}-${mesIndex}`}
                                style={estiloColunaValor(ehLucro)}
                                className="px-2 text-right text-[12px]"
                              >
                                {clicavel ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      abrirDrilldownCelula(linha, mesIndex)
                                    }
                                    className={btnCelulaClass}
                                    style={{ color: corValor }}
                                  >
                                    {money(valor)}
                                  </button>
                                ) : (
                                  <span style={{ color: corValor }}>{money(valor)}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {indicativosVisiveis &&
                        linhasIndicativos.map((linha, idx) => (
                          <tr key={linha.id} className="dre-linha-indicativo">
                            <td
                              style={{
                                ...estiloLabelIndicativo,
                                borderTop: idx === 0 ? "1px solid #b2ebf2" : undefined,
                              }}
                              className="pl-5 pr-3 text-left text-[12px]"
                            >
                              {linha.label}
                            </td>
                            {linha.valores.map((valor, mesIndex) => (
                              <td
                                key={`${linha.id}-${mesIndex}`}
                                style={estiloValorIndicativo}
                                className="px-2 text-center text-[12px] font-medium"
                              >
                                <span
                                  style={{ color: corValorIndicativo(linha.tipo) }}
                                >
                                  {formatarValorIndicativo(valor, linha.tipo)}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#bfdbfe] bg-[#eff6ff] px-5 py-3.5 text-[12px] leading-relaxed text-[#1d4ed8] print:hidden">
              Para visualizar os lançamentos, clique tanto no Nome do mês, quanto nos
              Valores!
            </div>
          </>
        ) : (
          <DreGraficos matriz={matriz} carregando={carregando} />
        )}
      </div>

      <ImprimirDreModal
        open={imprimirModalAberto}
        onClose={() => setImprimirModalAberto(false)}
        matriz={matriz}
        planoContas={planoContas}
        anoPadrao={ano}
        onAbrirPdf={abrirPdfViewer}
      />

      {drilldown && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-sm border border-[#e5e7eb] bg-white shadow-lg">
            <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <h3 className="text-[13px] font-semibold text-[#374151]">{drilldown.titulo}</h3>
              <button
                type="button"
                onClick={() => setDrilldown(null)}
                className="text-[#6b7280] hover:text-[#374151]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {lancamentosDrill.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-[#9ca3af]">
                  Nenhum lançamento neste período.
                </p>
              ) : (
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#f3f4f6] text-left text-[#6b7280]">
                      <th className="px-2 py-2 font-semibold">Data</th>
                      <th className="px-2 py-2 font-semibold">Descrição</th>
                      <th className="px-2 py-2 font-semibold">Categoria</th>
                      <th className="px-2 py-2 text-right font-semibold">Valor</th>
                      <th className="px-2 py-2 font-semibold">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosDrill.map((l) => {
                      const pack = desempacotarDespesa(l.descricao);
                      return (
                        <tr key={l.id} className="border-b border-[#f3f4f6]">
                          <td className="px-2 py-2 text-[#374151]">
                            {new Date(l.data).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-2 py-2 text-[#374151]">
                            {pack.texto || l.descricao}
                          </td>
                          <td className="px-2 py-2 text-[#6b7280]">{pack.categoria}</td>
                          <td
                            className={cn(
                              "px-2 py-2 text-right font-medium",
                              l.tipo === "receita" ? "text-[#2e7d32]" : "text-[#c62828]"
                            )}
                          >
                            {money(l.valor)}
                          </td>
                          <td className="px-2 py-2 capitalize text-[#6b7280]">
                            {l.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .dre-tabela {
          border-collapse: collapse;
          border-spacing: 0;
        }
        .dre-tabela th,
        .dre-tabela td {
          border-left: none !important;
          border-right: none !important;
        }
        .dre-tabela tbody tr:last-child td {
          border-bottom: none !important;
        }
        @media print {
          .dre-relatorio .print\\:hidden {
            display: none !important;
          }
          .dre-relatorio .dre-tabela {
            min-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
