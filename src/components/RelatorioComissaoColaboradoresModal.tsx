"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import type { LinhaComissaoColaborador } from "@/lib/comissoes-colaboradores";
import { gerarRelatorioComissaoColaboradoresModelo1Pdf } from "@/lib/pdf-relatorio-comissao-colaboradores-modelo1";
import { gerarRelatorioComissaoColaboradoresModelo2Pdf } from "@/lib/pdf-relatorio-comissao-colaboradores-modelo2";
import { prepararAbaPdf, abrirPdfNoVisualizador } from "@/lib/pdf-viewer";
import {
  filtrarLinhasRelatorioComissao,
  ordenarLinhasRelatorioComissao,
  type FiltroRelatorioComissaoColaboradores,
  type ModeloRelatorioComissao,
  type OrdenarPorRelatorioComissao,
} from "@/lib/relatorio-comissao-colaboradores";
import type { LancamentoFaturaOs } from "@/lib/os-faturamento";
import { STATUS_TRABALHO } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ColaboradorOpcao = { id: string; nome: string };
type EtapaOpcao = { id: string; nome: string };

type TrabalhoResumo = {
  id: string;
  numeroOs: number;
  grupoOsId?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  linhas: LinhaComissaoColaborador[];
  trabalhos: TrabalhoResumo[];
  colaboradores: ColaboradorOpcao[];
  etapas: EtapaOpcao[];
  idsSelecionados: Set<string>;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const selectClass =
  "h-9 w-full appearance-none rounded-sm border border-slate-300 bg-white px-2.5 pr-8 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const dataInputClass =
  "h-9 w-full rounded-sm border border-slate-300 bg-white pl-8 pr-2 text-[12px] text-slate-800 shadow-none outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

const Z_CALENDARIO_MODAL = 10050;

const MODELOS_RELATORIO: { value: ModeloRelatorioComissao; label: string }[] = [
  { value: "modelo-1", label: "Modelo 1" },
  { value: "modelo-2", label: "Modelo 2" },
];

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

function CampoCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
      />
      <span>{label}</span>
    </label>
  );
}

export function RelatorioComissaoColaboradoresModal({
  open,
  onClose,
  linhas,
  trabalhos,
  colaboradores,
  etapas,
  idsSelecionados,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPorRelatorioComissao>("paciente");
  const [colaborador, setColaborador] = useState("todos");
  const [periodoCampo, setPeriodoCampo] =
    useState<FiltroRelatorioComissaoColaboradores["periodoCampo"]>("data_lancamento");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [situacaoFinanceira, setSituacaoFinanceira] =
    useState<FiltroRelatorioComissaoColaboradores["situacaoFinanceira"]>("nao_faturados");
  const [situacao, setSituacao] = useState("");
  const [etapa, setEtapa] = useState("todos");
  const [modelo, setModelo] = useState<ModeloRelatorioComissao>("modelo-1");
  const [mostrarPaciente, setMostrarPaciente] = useState(true);
  const [mostrarCliente, setMostrarCliente] = useState(true);
  const [mostrarValorServico, setMostrarValorServico] = useState(true);
  const [incluirComissaoZero, setIncluirComissaoZero] = useState(true);
  const [calendarioAberto, setCalendarioAberto] = useState<"inicio" | "final" | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState("");

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setOrdenarPor("paciente");
    setColaborador(idsSelecionados.size > 0 ? "selecionados" : "todos");
    setPeriodoCampo("data_lancamento");
    setDataInicio("");
    setDataFinal("");
    setSituacaoFinanceira("nao_faturados");
    setSituacao("");
    setEtapa("todos");
    setModelo("modelo-1");
    setMostrarPaciente(true);
    setMostrarCliente(true);
    setMostrarValorServico(true);
    setIncluirComissaoZero(true);
    setCalendarioAberto(null);
    setErroPdf("");
  }, [open, idsSelecionados.size]);

  function montarFiltro(): FiltroRelatorioComissaoColaboradores {
    return {
      ordenarPor,
      colaborador,
      idsSelecionados,
      periodoCampo,
      dataInicio,
      dataFinal,
      situacaoFinanceira,
      situacao,
      etapa,
      modelo,
      mostrarPaciente,
      mostrarCliente,
      mostrarValorServico,
      incluirComissaoZero,
    };
  }

  async function imprimir() {
    const janela = prepararAbaPdf();
    if (!janela) {
      setErroPdf(
        "Não foi possível abrir a nova aba. Verifique se pop-ups estão permitidos."
      );
      return;
    }

    setGerandoPdf(true);
    setErroPdf("");

    try {
      const filtro = montarFiltro();
      let lancamentos: LancamentoFaturaOs[] = [];
      if (filtro.situacaoFinanceira !== "todos") {
        const res = await fetch("/api/financeiro");
        const data = (await res.json()) as LancamentoFaturaOs[];
        lancamentos = Array.isArray(data) ? data : [];
      }

      const filtradas = filtrarLinhasRelatorioComissao(
        linhas,
        filtro,
        trabalhos,
        lancamentos
      );
      const ordenadas = ordenarLinhasRelatorioComissao(filtradas, filtro.ordenarPor);

      const blob =
        filtro.modelo === "modelo-2"
          ? await gerarRelatorioComissaoColaboradoresModelo2Pdf(ordenadas, filtro)
          : await gerarRelatorioComissaoColaboradoresModelo1Pdf(ordenadas, filtro);
      abrirPdfNoVisualizador(
        blob,
        "relatorio-comissao.pdf",
        "Comissões Colaboradores",
        janela
      );
      onClose();
    } catch (err) {
      console.error("relatorio comissao pdf", err);
      janela.close();
      setErroPdf("Não foi possível gerar o PDF do relatório de comissão.");
    } finally {
      setGerandoPdf(false);
    }
  }

  if (!open || !portalPronto) return null;

  const conteudo = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
      data-modal="relatorio-comissao-colaboradores"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relatorio-comissao-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-[700px] rounded-sm border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2
            id="relatorio-comissao-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            Relatório Comissão
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
          <CampoSelect
            label="Ordenar Por"
            value={ordenarPor}
            onChange={(value) => setOrdenarPor(value as OrdenarPorRelatorioComissao)}
          >
            <option value="paciente">Paciente</option>
            <option value="cliente">Cliente</option>
            <option value="colaborador">Colaborador</option>
            <option value="os">OS</option>
            <option value="data_lancamento">Data Lançamento</option>
            <option value="data_entrega">Data Entrega</option>
            <option value="servico">Serviço</option>
            <option value="comissao">Comissão</option>
          </CampoSelect>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoSelect
              label="Colaboradores"
              value={colaborador}
              onChange={setColaborador}
            >
              <option value="todos">Todos</option>
              <option value="selecionados">selecionados</option>
              {colaboradores.map((item) => (
                <option key={item.id} value={item.nome}>
                  {item.nome}
                </option>
              ))}
            </CampoSelect>

            <div>
              <label className={labelClass}>Período</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="relative">
                  <select
                    value={periodoCampo}
                    onChange={(e) =>
                      setPeriodoCampo(
                        e.target.value as FiltroRelatorioComissaoColaboradores["periodoCampo"]
                      )
                    }
                    className={selectClass}
                  >
                    <option value="data_lancamento">Data Lançamento</option>
                    <option value="data_entrega">Data Entrega</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                    ▾
                  </span>
                </div>
                <CampoDataBr
                  value={dataInicio}
                  onChange={setDataInicio}
                  placeholder="Data Início"
                  iconPosition="left"
                  className="space-y-0"
                  inputClassName={dataInputClass}
                  calendarZIndex={Z_CALENDARIO_MODAL}
                  forceClose={calendarioAberto === "final"}
                  onCalendarOpenChange={(aberto) =>
                    setCalendarioAberto(aberto ? "inicio" : null)
                  }
                />
                <CampoDataBr
                  value={dataFinal}
                  onChange={setDataFinal}
                  placeholder="Data Final"
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
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CampoSelect
              label="Situação Financeira"
              value={situacaoFinanceira}
              onChange={(value) =>
                setSituacaoFinanceira(
                  value as FiltroRelatorioComissaoColaboradores["situacaoFinanceira"]
                )
              }
              mostrarLimpar={situacaoFinanceira !== "todos"}
              onLimpar={() => setSituacaoFinanceira("todos")}
            >
              <option value="todos">Todos</option>
              <option value="nao_faturados">Não Faturados</option>
              <option value="faturados">Faturados</option>
            </CampoSelect>

            <CampoSelect label="Situação" value={situacao} onChange={setSituacao}>
              <option value=""> </option>
              {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </CampoSelect>

            <CampoSelect
              label="Etapas"
              value={etapa}
              onChange={setEtapa}
              mostrarLimpar={etapa !== "todos"}
              onLimpar={() => setEtapa("todos")}
            >
              <option value="todos">Todas</option>
              {etapas.map((item) => (
                <option key={item.id} value={item.nome}>
                  {item.nome}
                </option>
              ))}
            </CampoSelect>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
              <CampoSelect
                label="Modelo Relatórios"
                value={modelo}
                onChange={(value) => setModelo(value as ModeloRelatorioComissao)}
              >
                {MODELOS_RELATORIO.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </CampoSelect>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-1">
              <CampoCheckbox
                label="Paciente"
                checked={mostrarPaciente}
                onChange={setMostrarPaciente}
              />
              <CampoCheckbox
                label="Cliente"
                checked={mostrarCliente}
                onChange={setMostrarCliente}
              />
              <CampoCheckbox
                label="Valor Serviço"
                checked={mostrarValorServico}
                onChange={setMostrarValorServico}
              />
              <CampoCheckbox
                label="Comissão Zero"
                checked={incluirComissaoZero}
                onChange={setIncluirComissaoZero}
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
              onClick={() => void imprimir()}
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
