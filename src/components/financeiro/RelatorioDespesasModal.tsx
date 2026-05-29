"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { dateToBrShort } from "@/lib/datas-br";
import { prepararAbaPdf } from "@/lib/pdf-viewer";
import {
  filtrarLinhasRelatorio,
  imprimirRelatorioDespesas,
  linhasRelatorioFromLancamentos,
  ordenarLinhasRelatorio,
  type FiltroRelatorioDespesas,
} from "@/lib/relatorio-despesas";

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lancamentos: Lancamento[];
};

const selectClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";

function periodoMesAtual() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setDate(1);
  const fim = new Date(hoje);
  fim.setMonth(hoje.getMonth() + 1, 0);
  return { inicio: dateToBrShort(inicio), fim: dateToBrShort(fim) };
}

export function RelatorioDespesasModal({ open, onClose, lancamentos }: Props) {
  const { inicio: inicioPadrao, fim: fimPadrao } = periodoMesAtual();

  const [modelo, setModelo] = useState("despesas-modelo-1");
  const [ordenarPor, setOrdenarPor] =
    useState<FiltroRelatorioDespesas["ordenarPor"]>("data_lancamento");
  const [situacao, setSituacao] =
    useState<FiltroRelatorioDespesas["situacao"]>("todos");
  const [categoria, setCategoria] = useState("todos");
  const [nome, setNome] = useState("todos");
  const [periodoCampo, setPeriodoCampo] =
    useState<FiltroRelatorioDespesas["periodoCampo"]>("data_lancamento");
  const [dataInicio, setDataInicio] = useState(inicioPadrao);
  const [dataFinal, setDataFinal] = useState(fimPadrao);

  useEffect(() => {
    if (!open) return;
    const { inicio, fim } = periodoMesAtual();
    setDataInicio(inicio);
    setDataFinal(fim);
    setSituacao("todos");
    setCategoria("todos");
    setNome("todos");
    setOrdenarPor("data_lancamento");
    setPeriodoCampo("data_lancamento");
    setModelo("despesas-modelo-1");
  }, [open]);

  const linhasBase = useMemo(
    () => linhasRelatorioFromLancamentos(lancamentos),
    [lancamentos]
  );

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhasBase) {
      if (l.categoria && l.categoria !== "—") set.add(l.categoria);
    }
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [linhasBase]);

  const nomes = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhasBase) {
      if (l.nome && l.nome !== "—") set.add(l.nome);
    }
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [linhasBase]);

  function imprimir() {
    const janela = prepararAbaPdf();
    const filtro: FiltroRelatorioDespesas = {
      ordenarPor,
      situacao,
      categoria,
      nome,
      periodoCampo,
      dataInicio,
      dataFinal,
    };
    const filtradas = filtrarLinhasRelatorio(linhasBase, filtro);
    const ordenadas = ordenarLinhasRelatorio(filtradas, ordenarPor);
    const modeloLabel =
      modelo === "despesas-modelo-1" ? "Despesas - Modelo 1" : modelo;
    const periodoLabel = `${periodoCampo === "data_lancamento" ? "Data Lançamento" : "Data Vencimento"}: ${dataInicio} a ${dataFinal}`;
    void imprimirRelatorioDespesas(ordenadas, modeloLabel, periodoLabel, janela).catch(
      () => {
        alert("Não foi possível gerar o PDF. Permita pop-ups para este site.");
      }
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="relatorio-despesas-titulo"
        className="relative w-full max-w-[720px] rounded-md bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2
            id="relatorio-despesas-titulo"
            className="text-[15px] font-medium text-slate-700"
          >
            Relatório Despesas
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

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Modelo Relatório</label>
              <select
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className={selectClass}
              >
                <option value="despesas-modelo-1">Despesas - Modelo 1</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Ordenar Por</label>
              <select
                value={ordenarPor}
                onChange={(e) =>
                  setOrdenarPor(e.target.value as FiltroRelatorioDespesas["ordenarPor"])
                }
                className={selectClass}
              >
                <option value="data_lancamento">Data Lançamento</option>
                <option value="vencimento">Data Vencimento</option>
                <option value="nome">Nome</option>
                <option value="valor">Valor</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Situação Financeira</label>
              <div className="relative">
                <select
                  value={situacao}
                  onChange={(e) =>
                    setSituacao(e.target.value as FiltroRelatorioDespesas["situacao"])
                  }
                  className={selectClass}
                >
                  <option value="todos">Todos</option>
                  <option value="a_pagar">A Pagar</option>
                  <option value="pagas">Pagas</option>
                  <option value="atraso">Em Atraso</option>
                </select>
                {situacao !== "todos" && (
                  <button
                    type="button"
                    onClick={() => setSituacao("todos")}
                    className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Limpar"
                    aria-label="Limpar situação"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className={selectClass}
              >
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c === "todos" ? "Todos" : c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Nome</label>
              <select
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={selectClass}
              >
                {nomes.map((n) => (
                  <option key={n} value={n}>
                    {n === "todos" ? "Todos" : n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Período</label>
              <select
                value={periodoCampo}
                onChange={(e) =>
                  setPeriodoCampo(
                    e.target.value as FiltroRelatorioDespesas["periodoCampo"]
                  )
                }
                className={selectClass}
              >
                <option value="data_lancamento">Data Lançamento</option>
                <option value="vencimento">Data Vencimento</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Data Início</label>
              <CampoDataBr
                value={dataInicio}
                onChange={setDataInicio}
                className="space-y-0"
                inputClassName="h-9 rounded border-slate-300 py-1.5 text-sm shadow-none"
              />
            </div>
            <div>
              <label className={labelClass}>Data Final</label>
              <CampoDataBr
                value={dataFinal}
                onChange={setDataFinal}
                className="space-y-0"
                inputClassName="h-9 rounded border-slate-300 py-1.5 text-sm shadow-none"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={imprimir}
              className="h-10 w-full rounded bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4]"
            >
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
