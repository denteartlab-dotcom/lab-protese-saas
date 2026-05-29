"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Home,
  Printer,
  Search,
} from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { PainelCarregando } from "@/components/ListaCarregando";
import { dateToBrShort } from "@/lib/datas-br";
import {
  criarIndiceTrabalhosCurvaAbc,
  exportarCurvaAbcClientesCsv,
  formatarPercentualCurvaAbc,
  gerarCurvaAbcClientes,
  type FiltrosCurvaAbcClientes,
  type IndiceTrabalhosCurvaAbc,
  type RecebimentoCurvaAbc,
  type ResultadoCurvaAbcClientes,
  type SecaoCurvaAbc,
  type TrabalhoCurvaAbc,
} from "@/lib/curva-abc-clientes";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarCurvaAbcClientesPdf } from "@/lib/relatorios-impressao-pdf";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";

const inputDataRelatorioClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white text-[12px] text-[#374151] shadow-none focus:border-[#4a90d9] focus:ring-0";

const OPCOES_SIM_NAO = [
  { value: "", label: "" },
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function primeiroDiaAnoBr() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), 0, 1));
}

function TabelaSecaoAbc({ secao }: { secao: SecaoCurvaAbc }) {
  const resumo = `${secao.linhas.length} Clientes representam ${secao.metaPercentual}% do Faturamento`;

  return (
    <section className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:break-inside-avoid print:border-[#e5e7eb] print:shadow-none">
      <div className="px-5 pb-2 pt-4">
        <p className="text-[42px] font-normal leading-none text-[#374151]">{secao.classe}</p>
        <p className="mt-1 text-[12px] text-[#9ca3af]">{resumo}</p>
      </div>
      <div className="pb-4">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[58%]" />
            <col className="w-[21%]" />
            <col className="w-[21%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#f3f4f6] text-[#6b7280]">
              <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide">
                Cliente
              </th>
              <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide">
                %
              </th>
              <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide">
                Valor
              </th>
            </tr>
          </thead>
          <tbody className="bg-white text-[#374151]">
            {secao.linhas.length === 0 ? (
              <tr>
                <td colSpan={3} className="h-8" />
              </tr>
            ) : (
              secao.linhas.map((linha) => (
                <tr key={linha.cliente} className="border-b border-[#f3f4f6] last:border-b-0">
                  <td className="px-4 py-3 text-center align-middle">{linha.cliente}</td>
                  <td className="px-4 py-3 text-center align-middle tabular-nums">
                    {formatarPercentualCurvaAbc(linha.percentual)}
                  </td>
                  <td className="px-4 py-3 text-center align-middle tabular-nums">
                    {money(linha.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[#f3f4f6] text-[#374151]">
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide">
                SUBTOTAL
              </td>
              <td className="px-4 py-3 text-center align-middle font-semibold tabular-nums">
                {money(secao.subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function CurvaAbcClientesConteudo() {
  const [carregando, setCarregando] = useState(true);
  const [recebimentos, setRecebimentos] = useState<RecebimentoCurvaAbc[]>([]);
  const [indiceTrabalhos, setIndiceTrabalhos] = useState<IndiceTrabalhosCurvaAbc>(() =>
    criarIndiceTrabalhosCurvaAbc([])
  );
  const [gerado, setGerado] = useState(false);

  const [dataInicio, setDataInicio] = useState(primeiroDiaAnoBr);
  const [dataFim, setDataFim] = useState(() => dateToBrShort(new Date()));
  const [repeticao, setRepeticao] = useState("");
  const [urgente, setUrgente] = useState("");

  const filtros = useMemo<FiltrosCurvaAbcClientes>(
    () => ({
      dataInicio,
      dataFim,
      repeticao,
      urgente,
    }),
    [dataInicio, dataFim, repeticao, urgente]
  );

  const recarregarDados = useCallback(async () => {
    try {
      const [resFin, resTrab] = await Promise.all([
        fetch("/api/financeiro", { cache: "no-store" }),
        fetch("/api/trabalhos", { cache: "no-store" }),
      ]);
      const fin = resFin.ok ? await resFin.json() : { lancamentos: [] };
      const listaFin = Array.isArray(fin.lancamentos) ? fin.lancamentos : [];
      setRecebimentos(
        listaFin.map(
          (l: {
            id: string;
            tipo: string;
            valor: number;
            data: string;
            status: string;
            cliente?: { id?: string; nome?: string | null } | null;
            clienteId?: string | null;
            trabalhoId?: string | null;
            trabalho?: { id: string; numeroOs?: number } | null;
          }) => ({
            id: l.id,
            tipo: l.tipo,
            valor: Number(l.valor) || 0,
            data: l.data,
            status: l.status,
            cliente: l.cliente,
            clienteId: l.clienteId ?? l.cliente?.id ?? null,
            trabalhoId: l.trabalhoId ?? l.trabalho?.id ?? null,
            numeroOs: l.trabalho?.numeroOs ?? null,
          })
        )
      );

      const trab = resTrab.ok ? await resTrab.json() : [];
      const listaTrab: TrabalhoCurvaAbc[] = Array.isArray(trab)
        ? trab.map(
            (t: {
              id: string;
              numeroOs: number;
              tipoProtese?: string;
              instrucoes?: string | null;
              clienteId?: string | null;
              cliente?: { id?: string } | null;
            }) => ({
              id: t.id,
              numeroOs: Number(t.numeroOs) || 0,
              tipoProtese: t.tipoProtese || "",
              instrucoes: t.instrucoes,
              clienteId: t.clienteId ?? t.cliente?.id ?? null,
            })
          )
        : [];
      setIndiceTrabalhos(criarIndiceTrabalhosCurvaAbc(listaTrab));
    } catch {
      setRecebimentos([]);
      setIndiceTrabalhos(criarIndiceTrabalhosCurvaAbc([]));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setCarregando(true);
      await recarregarDados();
      setCarregando(false);
    })();
  }, [recarregarDados]);

  const resultado = useMemo<ResultadoCurvaAbcClientes | null>(() => {
    if (!gerado) return null;
    return gerarCurvaAbcClientes(recebimentos, indiceTrabalhos, filtros);
  }, [gerado, recebimentos, indiceTrabalhos, filtros]);

  function gerarRelatorio() {
    setGerado(true);
  }

  function imprimir() {
    const dados =
      resultado ?? gerarCurvaAbcClientes(recebimentos, indiceTrabalhos, filtros);
    if (!gerado) setGerado(true);
    const periodo = `${dataInicio} à ${dataFim}`;
    void abrirPdfGerando(
      () => gerarCurvaAbcClientesPdf(dados, periodo),
      "curva-abc-clientes.pdf"
    );
  }

  function exportarExcel() {
    const dados = resultado ?? gerarCurvaAbcClientes(recebimentos, indiceTrabalhos, filtros);
    exportarCurvaAbcClientesCsv(dados);
  }

  if (carregando) {
    return (
      <div className="min-h-[320px] bg-[#f3f4f6] pb-8 pt-1">
        <PainelCarregando mensagem="Carregando Curva ABC Clientes..." />
      </div>
    );
  }

  const exibir = resultado ?? {
    secoes: [
      { classe: "A" as const, metaPercentual: 50 as const, linhas: [], subtotal: 0 },
      { classe: "B" as const, metaPercentual: 30 as const, linhas: [], subtotal: 0 },
      { classe: "C" as const, metaPercentual: 20 as const, linhas: [], subtotal: 0 },
    ],
    total: 0,
  };

  return (
    <div className="curva-abc-clientes bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151] print:bg-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280]">Relatórios</h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[#6b7280]">Curva ABC Clientes</span>
        </div>
      </div>

      <div id="curva-abc-clientes-impressao" className="space-y-4 print:space-y-3">
        <div className="overflow-visible rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:hidden">
          <div className="flex flex-wrap items-end gap-3 px-4 py-4">
            <div className="min-w-[280px] flex-1">
              <label className={labelClass}>Período</label>
              <div className="flex flex-wrap items-center gap-2">
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
            <div className="w-full min-w-[100px] sm:w-[120px]">
              <label className={labelClass}>Repetição</label>
              <select
                className={selectClass}
                value={repeticao}
                onChange={(e) => setRepeticao(e.target.value)}
              >
                {OPCOES_SIM_NAO.map((op) => (
                  <option key={op.value || "todos"} value={op.value}>
                    {op.label || "\u00a0"}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full min-w-[100px] sm:w-[120px]">
              <label className={labelClass}>Urgente</label>
              <select
                className={selectClass}
                value={urgente}
                onChange={(e) => setUrgente(e.target.value)}
              >
                {OPCOES_SIM_NAO.map((op) => (
                  <option key={op.value || "todos"} value={op.value}>
                    {op.label || "\u00a0"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <button
                type="button"
                onClick={gerarRelatorio}
                className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#5cb85c] px-4 text-[12px] font-semibold text-white hover:bg-[#4cae4c]"
              >
                <Search className="h-4 w-4" />
                Gerar Relatório
              </button>
              <button
                type="button"
                onClick={imprimir}
                className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#4a90d9] px-4 text-[12px] font-semibold text-white hover:bg-[#3d7fc4]"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-sm bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {!gerado ? (
          <div className="rounded-sm border border-[#e5e7eb] bg-white px-4 py-16 text-center text-[#9ca3af] shadow-sm print:hidden">
            Clique em Gerar Relatório para exibir os dados.
          </div>
        ) : (
          <>
            <div className="space-y-4 print:space-y-3">
              {exibir.secoes.map((secao) => (
                <TabelaSecaoAbc key={secao.classe} secao={secao} />
              ))}
            </div>
            <div className="w-full bg-[#f3f4f6] py-3 text-center print:break-inside-avoid">
              <p className="text-[13px] font-semibold text-[#374151]">
                Total: <span className="tabular-nums">{money(exibir.total)}</span>
              </p>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #curva-abc-clientes-impressao,
          #curva-abc-clientes-impressao * {
            visibility: visible;
          }
          #curva-abc-clientes-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
