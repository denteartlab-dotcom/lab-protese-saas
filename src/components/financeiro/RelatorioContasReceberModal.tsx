"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { dateToBrShort } from "@/lib/datas-br";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import {
  filtrarLinhasRelatorioContasReceber,
  gerarRelatorioContasReceberBlob,
  linhasRelatorioFromLancamentos,
  ordenarLinhasRelatorioContasReceber,
  type FiltroRelatorioContasReceber,
} from "@/lib/relatorio-contas-receber";
import {
  labelModeloRelatorioReceitas,
  MODELOS_RELATORIO_RECEITAS,
  modeloEhExtratoPorCliente,
  modeloEhParcelasAReceber,
  type ModeloRelatorioReceitas,
} from "@/lib/relatorio-receitas-modelos";

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  createdAt?: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lancamentos: Lancamento[];
  trabalhos?: TrabalhoRelatorioFatura[];
};

const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

const selectClass =
  "h-[34px] w-full rounded border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

const inputDataClass =
  "h-[34px] w-full rounded border border-slate-300 py-0 pl-8 pr-2 text-[13px] shadow-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

function periodoMesAtual() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setDate(1);
  const fim = new Date(hoje);
  fim.setMonth(hoje.getMonth() + 1, 0);
  return { inicio: dateToBrShort(inicio), fim: dateToBrShort(fim) };
}

export function RelatorioContasReceberModal({
  open,
  onClose,
  lancamentos,
  trabalhos = [],
}: Props) {
  const { inicio: inicioPadrao, fim: fimPadrao } = periodoMesAtual();

  const [modelo, setModelo] = useState<ModeloRelatorioReceitas>("faturas-modelo-1");
  const [ordenarPor, setOrdenarPor] =
    useState<FiltroRelatorioContasReceber["ordenarPor"]>("data_lancamento");
  const [cliente, setCliente] = useState("todos");
  const [periodoCampo, setPeriodoCampo] =
    useState<FiltroRelatorioContasReceber["periodoCampo"]>("data_lancamento");
  const [periodoAtivo, setPeriodoAtivo] = useState(true);
  const [dataInicio, setDataInicio] = useState(inicioPadrao);
  const [dataFinal, setDataFinal] = useState(fimPadrao);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [parcelasSomenteAReceber, setParcelasSomenteAReceber] = useState(true);
  const [parcelasAgruparPorCliente, setParcelasAgruparPorCliente] = useState(true);
  const [recebimentosAgruparPorCliente, setRecebimentosAgruparPorCliente] = useState(true);

  useEffect(() => {
    if (!open) return;
    const { inicio, fim } = periodoMesAtual();
    setDataInicio(inicio);
    setDataFinal(fim);
    setCliente("todos");
    setOrdenarPor("data_lancamento");
    setPeriodoCampo("data_lancamento");
    setPeriodoAtivo(true);
    setModelo("faturas-modelo-1");
    setParcelasSomenteAReceber(true);
    setParcelasAgruparPorCliente(true);
    setRecebimentosAgruparPorCliente(true);
  }, [open]);

  const linhasBase = useMemo(
    () => linhasRelatorioFromLancamentos(lancamentos, trabalhos, modelo),
    [lancamentos, trabalhos, modelo]
  );

  const clientes = useMemo(() => {
    const set = new Set<string>();
    for (const l of lancamentos) {
      if (l.tipo !== "receita") continue;
      const nome = l.cliente?.nome;
      if (nome) set.add(nome);
    }
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [lancamentos]);

  function montarFiltro(): FiltroRelatorioContasReceber {
    return {
      modelo,
      ordenarPor,
      situacao: "todos",
      cliente,
      formaRecebimento: "todos",
      periodoCampo,
      periodoAtivo,
      dataInicio,
      dataFinal,
      parcelasSomenteAReceber: modeloEhParcelasAReceber(modelo)
        ? parcelasSomenteAReceber
        : undefined,
      parcelasAgruparPorCliente:
        modelo === "parcelas-a-receber-modelo-2" ? parcelasAgruparPorCliente : undefined,
    };
  }

  function imprimir() {
    const filtro = montarFiltro();
    const filtradas = filtrarLinhasRelatorioContasReceber(linhasBase, filtro);
    const ordenadas = ordenarLinhasRelatorioContasReceber(
      filtradas,
      ordenarPor,
      modelo
    );
    const modeloLabel = labelModeloRelatorioReceitas(modelo);
    const periodoLabel = filtro.periodoAtivo
      ? `${dataInicio} à ${dataFinal}`
      : "Período: todos";
    const nomeClienteExtrato =
      filtro.cliente !== "todos" ? filtro.cliente : ordenadas[0]?.cliente;
    const nomeClienteFiltro = filtro.cliente.trim().toLowerCase();
    const clienteIdExtrato =
      filtro.cliente !== "todos"
        ? lancamentos.find(
            (l) =>
              l.tipo === "receita" &&
              l.cliente?.nome?.trim().toLowerCase() === nomeClienteFiltro
          )?.cliente?.id ?? null
        : ordenadas[0]
          ? lancamentos.find((l) => l.id === ordenadas[0].lancamentoId)?.cliente?.id ?? null
          : null;

    if (modeloEhExtratoPorCliente(modelo) && !nomeClienteExtrato) {
      alert("Selecione um cliente para gerar o Extrato Financeiro.");
      return;
    }

    setGerandoPdf(true);
    void abrirPdfGerando(
      () =>
        gerarRelatorioContasReceberBlob(
          ordenadas,
          modeloLabel,
          periodoLabel,
          modelo,
          {
            periodoCampo: filtro.periodoCampo,
            dataInicio: filtro.dataInicio,
            dataFinal: filtro.dataFinal,
            periodoAtivo: filtro.periodoAtivo,
            ordenarPor: filtro.ordenarPor,
            nomeClienteExtrato,
            clienteIdExtrato,
            lancamentos,
            trabalhos,
            parcelasSomenteAReceber: filtro.parcelasSomenteAReceber,
            parcelasAgruparPorCliente: filtro.parcelasAgruparPorCliente,
            recebimentosAgruparPorCliente: filtro.recebimentosAgruparPorCliente,
          }
        ),
      "relatorio-receitas.pdf",
      modeloLabel
    )
      .catch(() => {
        alert("Não foi possível gerar o PDF. Permita pop-ups para abrir em nova aba.");
      })
      .finally(() => setGerandoPdf(false));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
          aria-hidden
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="relatorio-receitas-titulo"
          className="relative w-full max-w-[920px] rounded-sm bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5">
            <h2
              id="relatorio-receitas-titulo"
              className="text-[15px] font-medium text-slate-700"
            >
              Relatório Receitas
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-2 gap-6">
              <div className="min-w-0">
                <label className={labelClass}>Modelo Relatório</label>
                <select
                  value={modelo}
                  onChange={(e) => {
                    const valor = e.target.value as ModeloRelatorioReceitas;
                    setModelo(valor);
                    if (modeloEhParcelasAReceber(valor)) {
                      setPeriodoCampo("vencimento");
                      setParcelasSomenteAReceber(true);
                    }
                    if (valor === "parcelas-a-receber-modelo-2") {
                      setParcelasAgruparPorCliente(true);
                    }
                    if (valor === "recebimentos") {
                      setPeriodoCampo("vencimento");
                      setRecebimentosAgruparPorCliente(true);
                    }
                  }}
                  className={selectClass}
                >
                  {MODELOS_RELATORIO_RECEITAS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className={labelClass}>Ordenar Por</label>
                <select
                  value={
                    modelo === "parcelas-a-receber-modelo-1" ? "nao_disponivel" : ordenarPor
                  }
                  onChange={(e) =>
                    setOrdenarPor(
                      e.target.value as FiltroRelatorioContasReceber["ordenarPor"]
                    )
                  }
                  disabled={modelo === "parcelas-a-receber-modelo-1"}
                  className={selectClass}
                >
                  {modelo === "parcelas-a-receber-modelo-1" ? (
                    <option value="nao_disponivel">Não disponível</option>
                  ) : (
                    <>
                      <option value="data_lancamento">Data Lançamento</option>
                      <option value="vencimento">Data Vencimento</option>
                      <option value="cliente">Cliente</option>
                      <option value="valor">Valor</option>
                      <option value="fatura">Nº Fatura</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {(modelo === "parcelas-a-receber-modelo-2" || modelo === "recebimentos") && (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                {modelo === "parcelas-a-receber-modelo-2" && (
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={parcelasSomenteAReceber}
                      onChange={(e) => setParcelasSomenteAReceber(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    />
                    Mostrar somente a receber
                  </label>
                )}
                {(modelo === "parcelas-a-receber-modelo-2" || modelo === "recebimentos") && (
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={
                        modelo === "recebimentos"
                          ? recebimentosAgruparPorCliente
                          : parcelasAgruparPorCliente
                      }
                      onChange={(e) => {
                        if (modelo === "recebimentos") {
                          setRecebimentosAgruparPorCliente(e.target.checked);
                        } else {
                          setParcelasAgruparPorCliente(e.target.checked);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    />
                    Agrupar por cliente
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
              <div className="min-w-0">
                <label className={labelClass}>Clientes</label>
                <select
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className={selectClass}
                >
                  {clientes.map((c) => (
                    <option key={c} value={c}>
                      {c === "todos" ? "Todos" : c}
                    </option>
                  ))}
                </select>
                {modelo === "parcelas-a-receber-modelo-1" && (
                  <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={parcelasSomenteAReceber}
                      onChange={(e) => setParcelasSomenteAReceber(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    />
                    Mostrar somente a receber
                  </label>
                )}
                <button
                  type="button"
                  onClick={imprimir}
                  title="Visualizar relatório em PDF"
                  className="mt-2.5 flex h-[34px] w-[34px] items-center justify-center rounded border border-[#4a90d9] bg-white text-[#4a90d9] hover:bg-blue-50"
                >
                  <FileText className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0">
                <label className={labelClass}>Período</label>
                <div className="flex h-[34px] w-full items-stretch gap-1.5">
                  <select
                    value={periodoCampo}
                    onChange={(e) =>
                      setPeriodoCampo(
                        e.target.value as FiltroRelatorioContasReceber["periodoCampo"]
                      )
                    }
                    className="h-full w-[11.25rem] shrink-0 rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                  >
                    <option value="data_lancamento">Data Lançamento</option>
                    <option value="vencimento">Data Vencimento</option>
                  </select>
                  <label className="flex w-6 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={periodoAtivo}
                      onChange={(e) => setPeriodoAtivo(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                      aria-label="Filtrar por período"
                    />
                  </label>
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    disabled={!periodoAtivo}
                    iconPosition="left"
                    className="h-[34px] min-w-[8rem] flex-1 space-y-0 [&>div]:h-full"
                    inputClassName={inputDataClass}
                  />
                  <CampoDataBr
                    value={dataFinal}
                    onChange={setDataFinal}
                    disabled={!periodoAtivo}
                    iconPosition="left"
                    className="h-[34px] min-w-[8rem] flex-1 space-y-0 [&>div]:h-full"
                    inputClassName={inputDataClass}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <button
                type="button"
                onClick={imprimir}
                disabled={gerandoPdf}
                className="h-11 rounded-sm bg-[#4a90d9] text-sm font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
              >
                {gerandoPdf ? "Gerando PDF..." : "Imprimir"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-sm border border-slate-500 bg-white text-sm font-normal text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
