"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { cn } from "@/lib/utils";

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

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const selectClass =
  "h-9 w-full appearance-none rounded-sm border border-slate-300 bg-white px-2.5 pr-8 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const dataInputClass =
  "h-9 w-full rounded-sm border border-slate-300 bg-white pl-8 pr-2 text-[12px] text-slate-800 shadow-none outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

const MODELOS_RELATORIO = [
  { value: "despesas-modelo-1", label: "Despesas - Modelo 1" },
  { value: "despesas-modelo-2", label: "Despesas - Modelo 2 (parcelas)" },
  { value: "despesas-modelo-3", label: "Despesas - Modelo 3 (completo)" },
  { value: "parcelas-a-pagar-1", label: "Parcelas (A Pagar) Modelo 1" },
  { value: "parcelas-a-pagar-2", label: "Parcelas (A Pagar) Modelo 2" },
  { value: "parcelas-pagas", label: "Parcelas (Pagas)" },
] as const;

const CATEGORIAS_ENTIDADE = [
  { value: "todos", label: "Todos" },
  { value: "fornecedores", label: "Fornecedores" },
  { value: "colaboradores", label: "Colaboradores" },
  { value: "prestadores", label: "Prestadores" },
  { value: "entregadores", label: "Entregadores" },
  { value: "clientes", label: "Clientes" },
] as const;

const Z_CALENDARIO_MODAL = 10050;

function periodoMesAtual() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setDate(1);
  const fim = new Date(hoje);
  fim.setMonth(hoje.getMonth() + 1, 0);
  return { inicio: dateToBrShort(inicio), fim: dateToBrShort(fim) };
}

function CampoSelect({
  label,
  value,
  onChange,
  children,
  onLimpar,
  mostrarLimpar = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  onLimpar?: () => void;
  mostrarLimpar?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(selectClass, mostrarLimpar && "pr-12")}
        >
          {children}
        </select>
        {mostrarLimpar && onLimpar ? (
          <button
            type="button"
            onClick={onLimpar}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            title="Limpar"
            aria-label={`Limpar ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
          ▾
        </span>
      </div>
    </div>
  );
}

export function RelatorioDespesasModal({ open, onClose, lancamentos }: Props) {
  const { inicio: inicioPadrao, fim: fimPadrao } = periodoMesAtual();
  const [portalPronto, setPortalPronto] = useState(false);

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
  const [calendarioAberto, setCalendarioAberto] = useState<"inicio" | "final" | null>(
    null
  );
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState("");

  useEffect(() => {
    setPortalPronto(true);
  }, []);

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
    setCalendarioAberto(null);
    setErroPdf("");
  }, [open]);

  const linhasBase = useMemo(
    () => linhasRelatorioFromLancamentos(lancamentos),
    [lancamentos]
  );

  const nomes = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhasBase) {
      if (categoria !== "todos" && l.entidade !== categoria) continue;
      if (l.nome && l.nome !== "—") set.add(l.nome);
    }
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [linhasBase, categoria]);

  useEffect(() => {
    if (nome !== "todos" && !nomes.includes(nome)) setNome("todos");
  }, [nome, nomes]);

  const modeloLabel =
    MODELOS_RELATORIO.find((item) => item.value === modelo)?.label ?? modelo;

  function imprimir() {
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
    const periodoLabel = `${periodoCampo === "data_lancamento" ? "Data Lançamento" : "Data Vencimento"}: ${dataInicio} a ${dataFinal}`;

    const janela = prepararAbaPdf();
    if (!janela) {
      setErroPdf(
        "Não foi possível abrir a nova aba. Verifique se pop-ups estão permitidos."
      );
      return;
    }

    setGerandoPdf(true);
    setErroPdf("");

    void (async () => {
      try {
        await imprimirRelatorioDespesas(
          ordenadas,
          modeloLabel,
          periodoLabel,
          janela,
          {
            modelo,
            periodoCampo,
            dataInicio,
            dataFinal,
            lancamentos,
          }
        );
        onClose();
      } catch (err) {
        console.error("relatorio despesas pdf", err);
        janela.close();
        setErroPdf("Não foi possível gerar o PDF do relatório de despesas.");
      } finally {
        setGerandoPdf(false);
      }
    })();
  }

  if (!open || !portalPronto) return null;

  const conteudo = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
      data-modal="relatorio-despesas-smart"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relatorio-despesas-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-[700px] rounded-sm border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2
            id="relatorio-despesas-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            Relatório Despesas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] leading-none text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CampoSelect
              label="Modelo Relatório"
              value={modelo}
              onChange={setModelo}
            >
              {MODELOS_RELATORIO.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </CampoSelect>

            <CampoSelect
              label="Ordenar Por"
              value={ordenarPor}
              onChange={(value) =>
                setOrdenarPor(value as FiltroRelatorioDespesas["ordenarPor"])
              }
            >
              <option value="data_lancamento">Data Lançamento</option>
              <option value="vencimento">Data Vencimento</option>
              <option value="nome">Nome</option>
              <option value="valor">Valor</option>
            </CampoSelect>

            <CampoSelect
              label="Situação Financeira"
              value={situacao}
              onChange={(value) =>
                setSituacao(value as FiltroRelatorioDespesas["situacao"])
              }
              mostrarLimpar={situacao !== "todos"}
              onLimpar={() => setSituacao("todos")}
            >
              <option value="todos">Todos</option>
              <option value="a_pagar">A Pagar</option>
              <option value="pagas">Pagas</option>
              <option value="atraso">Em Atraso</option>
            </CampoSelect>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoSelect
              label="Categoria"
              value={categoria}
              onChange={setCategoria}
            >
              {CATEGORIAS_ENTIDADE.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </CampoSelect>

            <CampoSelect label="Nome" value={nome} onChange={setNome}>
              {nomes.map((n) => (
                <option key={n} value={n}>
                  {n === "todos" ? "Todos" : n}
                </option>
              ))}
            </CampoSelect>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CampoSelect
              label="Período"
              value={periodoCampo}
              onChange={(value) =>
                setPeriodoCampo(value as FiltroRelatorioDespesas["periodoCampo"])
              }
            >
              <option value="data_lancamento">Data Lançamento</option>
              <option value="vencimento">Data Vencimento</option>
            </CampoSelect>

            <div>
              <label className={labelClass}>Data Início</label>
              <CampoDataBr
                value={dataInicio}
                onChange={setDataInicio}
                iconPosition="left"
                className="space-y-0"
                inputClassName={dataInputClass}
                calendarZIndex={Z_CALENDARIO_MODAL}
                forceClose={calendarioAberto === "final"}
                onCalendarOpenChange={(aberto) =>
                  setCalendarioAberto(aberto ? "inicio" : null)
                }
              />
            </div>

            <div>
              <label className={labelClass}>Data Final</label>
              <CampoDataBr
                value={dataFinal}
                onChange={setDataFinal}
                iconPosition="left"
                className="space-y-0"
                inputClassName={dataInputClass}
                calendarZIndex={Z_CALENDARIO_MODAL}
                forceClose={calendarioAberto === "inicio"}
                onCalendarOpenChange={(aberto) =>
                  setCalendarioAberto(aberto ? "final" : null)
                }
              />
            </div>
          </div>

          {erroPdf ? (
            <p className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {erroPdf}
            </p>
          ) : null}

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={imprimir}
              disabled={gerandoPdf}
              className="h-10 w-full rounded-sm bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {gerandoPdf ? "Gerando PDF..." : "Imprimir"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-sm border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}
