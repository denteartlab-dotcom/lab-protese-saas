"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { PainelCarregando } from "@/components/ListaCarregando";
import { RelatorioCabecalho, RelatorioTituloLateral } from "@/components/relatorios/RelatorioCabecalho";
import {
  agruparLinhasPorCategoria,
  carregarDadosTabelaMargem,
  exportarMargemContribuicaoCsv,
  listarLinhasMargemContribuicao,
  type ItemCustoMargem,
  type LinhaMargemContribuicao,
  type OrdenacaoMargemContribuicao,
} from "@/lib/margem-contribuicao";
import { PRODUTOS_ESTOQUE_EVENT } from "@/lib/estoque";
import {
  carregarNomesTabelasPrecoRemoto,
  TABELA_PRECOS_EVENT,
} from "@/lib/tabela-precos-os";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarMargemContribuicaoPdf } from "@/lib/relatorios-impressao-pdf";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280] dark:text-slate-400";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-[12px] text-[#374151] dark:text-slate-200 outline-none focus:border-[#4a90d9]";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function DetalheCustosLinha({ itens }: { itens: ItemCustoMargem[] }) {
  return (
    <tr className="print:break-inside-avoid">
      <td colSpan={4} className="p-0">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#ececec] dark:bg-slate-700 text-[10px] font-semibold uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
              <th className="py-1.5 pl-8 text-left">Item</th>
              <th className="w-[32%] py-1.5 text-center">Quantidade</th>
              <th className="w-[22%] py-1.5 pr-8 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => (
              <tr
                key={`${item.item}-${index}`}
                className="border-b border-[#f0f0f0] dark:border-slate-700 bg-white dark:bg-slate-900 last:border-b-0"
              >
                <td className="py-1.5 pl-8 text-[#374151] dark:text-slate-200">{item.item}</td>
                <td className="py-1.5 text-center text-[#374151] dark:text-slate-200">{item.quantidade}</td>
                <td className="py-1.5 pr-8 text-right text-[#374151] dark:text-slate-200">
                  {money(item.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

function LinhasMargemTabela({
  linhas,
  expandidoId,
  onToggle,
}: {
  linhas: LinhaMargemContribuicao[];
  expandidoId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {linhas.map((linha) => {
        const expandido = expandidoId === linha.id;
        const podeExpandir = linha.itensCusto.length > 0;

        return (
          <Fragment key={linha.id}>
            <tr
              onClick={() => {
                if (podeExpandir) onToggle(linha.id);
              }}
              className={cn(
                "border-b border-[#e5e7eb] dark:border-slate-700 transition-colors",
                podeExpandir && "cursor-pointer",
                expandido
                  ? "bg-[#e8e8e8] dark:bg-slate-700"
                  : "bg-[#f3f4f6] hover:bg-[#ececec] dark:bg-slate-800 dark:hover:bg-slate-700",
                "print:hover:bg-[#f3f4f6]"
              )}
            >
              <td className="px-3 py-2 font-medium text-[#374151] dark:text-slate-200">{linha.nome}</td>
              <td className="w-28 px-3 py-2 text-right text-[#374151] dark:text-slate-200">
                {money(linha.valor)}
              </td>
              <td className="w-28 px-3 py-2 text-right font-medium text-[#c62828]">
                {money(linha.custo)}
              </td>
              <td className="w-36 px-3 py-2 text-right font-medium text-[#2e7d32]">
                {money(linha.margem)}
              </td>
            </tr>
            {expandido && podeExpandir && (
              <DetalheCustosLinha itens={linha.itensCusto} />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export function MargemContribuicaoConteudo() {
  const { t } = useI18n();
  const [tabelas, setTabelas] = useState<string[]>([]);
  const [tabela, setTabela] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoMargemContribuicao>("nome_servico");
  const [somenteComCustos, setSomenteComCustos] = useState(true);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [dadosTabela, setDadosTabela] = useState(
    () => carregarDadosTabelaMargem()
  );

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const nomes = await carregarNomesTabelasPrecoRemoto();
      setTabelas(nomes);
      setDadosTabela(carregarDadosTabelaMargem());
      setTabela((atual) => {
        if (atual && nomes.includes(atual)) return atual;
        return nomes[0] || "";
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const onAtualizar = () => void recarregar();
    window.addEventListener(TABELA_PRECOS_EVENT, onAtualizar);
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, onAtualizar);
    window.addEventListener("focus", onAtualizar);
    window.addEventListener("storage", onAtualizar);
    return () => {
      window.removeEventListener(TABELA_PRECOS_EVENT, onAtualizar);
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, onAtualizar);
      window.removeEventListener("focus", onAtualizar);
      window.removeEventListener("storage", onAtualizar);
    };
  }, [recarregar]);

  useEffect(() => {
    setExpandidoId(null);
  }, [tabela, somenteComCustos, ordenacao]);

  const linhas = useMemo(
    () => listarLinhasMargemContribuicao(dadosTabela, tabela, somenteComCustos),
    [dadosTabela, tabela, somenteComCustos]
  );

  const grupos = useMemo(
    () => agruparLinhasPorCategoria(dadosTabela, tabela, linhas, ordenacao),
    [dadosTabela, tabela, linhas, ordenacao]
  );

  function toggleExpandido(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id));
  }

  function exportarExcel() {
    if (!tabela) return;
    exportarMargemContribuicaoCsv(grupos, tabela);
  }

  function imprimir() {
    void abrirPdfGerando(
      () =>
        gerarMargemContribuicaoPdf(
          linhas.map((l) => ({
            categoria: l.categoria,
            nome: l.nome,
            valor: l.valor,
            custo: l.custo,
            margem: l.margem,
          })),
          `Tabela: ${tabela || "—"}`
        ),
      "margem-contribuicao.pdf"
    );
  }

  if (carregando) {
    return (
      <div className="min-h-[320px] bg-[#f3f4f6] dark:bg-slate-950 pb-8 pt-1">
        <PainelCarregando mensagem="Carregando margens de contribuição..." />
      </div>
    );
  }

  return (
    <div className="margem-contribuicao-relatorio bg-[#f3f4f6] dark:bg-slate-950 pb-8 pt-1 text-[12px] text-[#374151] dark:text-slate-200 print:bg-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <RelatorioTituloLateral />
        <RelatorioCabecalho labelKey="nav.relatorio.margemContribuicao" className="mb-0" />
      </div>

      <div className="overflow-hidden rounded-sm border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 py-4 print:hidden">
          <div className="min-w-[220px] flex-1">
            <label className={labelClass}>Selecione uma Tabela</label>
            <select
              className={selectClass}
              value={tabela}
              onChange={(e) => setTabela(e.target.value)}
            >
              {tabelas.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[180px] shrink-0">
            <label className={labelClass}>Ordenação</label>
            <select
              className={selectClass}
              value={ordenacao}
              onChange={(e) =>
                setOrdenacao(e.target.value as OrdenacaoMargemContribuicao)
              }
            >
              <option value="nome_servico">Nome do Serviço</option>
              <option value="valor">Valor</option>
              <option value="custo">Custo</option>
              <option value="margem">Margem de Contribuição</option>
              <option value="margem_pct">Margem de Contribuição %</option>
            </select>
          </div>

          <label className="mb-1 flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-[12px] text-[#374151] dark:text-slate-200">
            <input
              type="checkbox"
              checked={somenteComCustos}
              onChange={(e) => setSomenteComCustos(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#4a90d9]"
            />
            Mostrar apenas serviços com custos
          </label>

          <div className="ml-auto flex shrink-0 items-end gap-2">
            <div className="inline-flex overflow-hidden rounded-sm">
              <button
                type="button"
                onClick={imprimir}
                className="flex h-[34px] w-[34px] items-center justify-center bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
                title={t("relatorio.imprimir")}
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-[34px] w-[28px] items-center justify-center border-l border-[#3d7fc4] bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
                title="Opções de impressão"
                aria-label="Opções de impressão"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={exportarExcel}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-sm bg-[#22c55e] text-white hover:bg-[#16a34a]"
              title={t("relatorio.excel")}
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div id="margem-contribuicao-impressao" className="border-t border-[#e5e7eb] dark:border-slate-700">
          {grupos.length === 0 ? (
            <div className="flex min-h-[280px] items-center justify-center px-4 py-12 text-[12px] text-[#9ca3af] dark:text-slate-400">
              {somenteComCustos
                ? "Nenhum serviço com custo cadastrado para esta tabela."
                : "Nenhum serviço sem custo cadastrado para esta tabela."}
            </div>
          ) : (
            <div className="space-y-4 p-3 print:space-y-3 print:p-2">
              {grupos.map((grupo) => (
                <section
                  key={grupo.categoriaId}
                  className="overflow-hidden rounded border border-primary-300 bg-white dark:bg-slate-900 shadow-sm print:break-inside-avoid print:shadow-none"
                >
                  <div className="border-b border-primary-700 bg-primary-600 px-4 py-2.5">
                    <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">
                      {grupo.categoriaNome}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 text-left text-[#6b7280] dark:text-slate-400">
                          <th className="px-3 py-2 font-semibold uppercase">Serviço</th>
                          <th className="w-28 px-3 py-2 text-right font-semibold uppercase">
                            Valor
                          </th>
                          <th className="w-28 px-3 py-2 text-right font-semibold uppercase">
                            Custos
                          </th>
                          <th className="w-36 px-3 py-2 text-right font-semibold uppercase">
                            Margem
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <LinhasMargemTabela
                          linhas={grupo.linhas}
                          expandidoId={expandidoId}
                          onToggle={toggleExpandido}
                        />
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #margem-contribuicao-impressao,
          #margem-contribuicao-impressao * {
            visibility: visible;
          }
          #margem-contribuicao-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
