"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useI18n } from "@/components/i18n-provider";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import {
  SITUACOES_ENTREGA,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import { dateToBrShort } from "@/lib/datas-br";
import {
  MODELOS_RELATORIO_ENTREGAS,
  carregarTrabalhosParaRelatorioEntregas,
  exportarRelatorioEntregasCsv,
  gerarLinhasRelatorioEntregas,
  imprimirRelatorioEntregas,
  type FiltroRelatorioEntregas,
} from "@/lib/relatorio-entregas";
import { cn } from "@/lib/utils";
import type { TradutorUi } from "@/lib/i18n/tr-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  entregas: EntregaControle[];
  entregadores: string[];
  filtrosIniciais?: Partial<FiltroRelatorioEntregas>;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const selectClass =
  "h-9 w-full appearance-none rounded-sm border border-slate-300 bg-white px-2.5 pr-8 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const dataInputClass =
  "h-9 w-full rounded-sm border border-slate-300 bg-white pl-8 pr-2 text-[12px] text-slate-800 shadow-none outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

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
  t,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  onLimpar?: () => void;
  mostrarLimpar?: boolean;
  t: TradutorUi;
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
            title={t("cadastros.comum.limpar")}
            aria-label={t("relatorio.comum.limparCampo", { campo: label })}
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

export function RelatorioEntregasModal({
  open,
  onClose,
  entregas,
  entregadores,
  filtrosIniciais,
}: Props) {
  const { t } = useI18n();
  const { inicio: inicioPadrao, fim: fimPadrao } = periodoMesAtual();
  const [portalPronto, setPortalPronto] = useState(false);
  const [gerando, setGerando] = useState(false);

  const [modelo, setModelo] =
    useState<FiltroRelatorioEntregas["modelo"]>("entregas-modelo-1");
  const [ordenarPor, setOrdenarPor] =
    useState<FiltroRelatorioEntregas["ordenarPor"]>("data_pedido");
  const [situacao, setSituacao] = useState<"" | SituacaoEntrega>("");
  const [entregador, setEntregador] = useState("");
  const [periodo, setPeriodo] = useState<FiltroRelatorioEntregas["periodo"]>("pedido");
  const [dataInicio, setDataInicio] = useState(inicioPadrao);
  const [dataFinal, setDataFinal] = useState(fimPadrao);
  const [calendarioAberto, setCalendarioAberto] = useState<"inicio" | "final" | null>(
    null
  );

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const { inicio, fim } = periodoMesAtual();
    setModelo(filtrosIniciais?.modelo ?? "entregas-modelo-1");
    setOrdenarPor(filtrosIniciais?.ordenarPor ?? "data_pedido");
    setSituacao(filtrosIniciais?.situacao ?? "");
    setEntregador(filtrosIniciais?.entregador ?? "");
    setPeriodo(filtrosIniciais?.periodo ?? "pedido");
    setDataInicio(filtrosIniciais?.dataInicio ?? inicio);
    setDataFinal(filtrosIniciais?.dataFinal ?? fim);
    setCalendarioAberto(null);
  }, [open, filtrosIniciais]);

  const filtroAtual = useMemo<FiltroRelatorioEntregas>(
    () => ({
      modelo,
      ordenarPor,
      situacao,
      entregador,
      periodo,
      dataInicio,
      dataFinal,
      busca: filtrosIniciais?.busca ?? "",
    }),
    [
      modelo,
      ordenarPor,
      situacao,
      entregador,
      periodo,
      dataInicio,
      dataFinal,
      filtrosIniciais?.busca,
    ]
  );

  const totalFiltrado = useMemo(
    () => gerarLinhasRelatorioEntregas(entregas, filtroAtual).length,
    [entregas, filtroAtual]
  );

  async function obterLinhasComProducao() {
    const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
    return gerarLinhasRelatorioEntregas(entregas, filtroAtual, trabalhos);
  }

  async function imprimir() {
    setGerando(true);
    try {
      const linhas = await obterLinhasComProducao();
      await imprimirRelatorioEntregas(linhas, filtroAtual);
    } catch (err) {
      console.error("[relatorio-entregas] imprimir", err);
      alert(
        err instanceof Error && err.message
          ? err.message
          : t("relatorio.entregas.erroGerar")
      );
    } finally {
      setGerando(false);
    }
  }

  async function exportar() {
    setGerando(true);
    try {
      const linhas = await obterLinhasComProducao();
      exportarRelatorioEntregasCsv(linhas, modelo);
    } finally {
      setGerando(false);
    }
  }

  if (!open || !portalPronto) return null;

  const conteudo = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
      data-modal="relatorio-entregas-smart"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relatorio-entregas-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-[700px] rounded-sm border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2
            id="relatorio-entregas-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            {t("relatorio.entregas.tituloModal")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] leading-none text-slate-400 hover:text-slate-600"
            aria-label={t("cadastros.comum.fechar")}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CampoSelect
              t={t}
              label={t("relatorio.comum.modeloRelatorio")}
              value={modelo}
              onChange={(value) =>
                setModelo(value as FiltroRelatorioEntregas["modelo"])
              }
            >
              {MODELOS_RELATORIO_ENTREGAS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </CampoSelect>

            <CampoSelect
              t={t}
              label={t("relatorio.comum.ordenarPor")}
              value={ordenarPor}
              onChange={(value) =>
                setOrdenarPor(value as FiltroRelatorioEntregas["ordenarPor"])
              }
            >
              <option value="data_pedido">{t("relatorio.comum.dataPedido")}</option>
              <option value="data_finalizado">{t("relatorio.filtro.dataFim")}</option>
              <option value="destinatario">{t("relatorio.comum.destinatario")}</option>
              <option value="entregador">{t("relatorio.comum.entregador")}</option>
              <option value="valor">{t("relatorio.comum.valor")}</option>
            </CampoSelect>

            <CampoSelect
              t={t}
              label={t("relatorio.comum.situacao")}
              value={situacao}
              onChange={(value) => setSituacao(value as "" | SituacaoEntrega)}
              mostrarLimpar={Boolean(situacao)}
              onLimpar={() => setSituacao("")}
            >
              <option value="">{t("relatorio.opcao.todos")}</option>
              {Object.entries(SITUACOES_ENTREGA).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </CampoSelect>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoSelect
              t={t}
              label={t("relatorio.comum.entregador")}
              value={entregador}
              onChange={setEntregador}
              mostrarLimpar={Boolean(entregador)}
              onLimpar={() => setEntregador("")}
            >
              <option value="">{t("relatorio.opcao.todos")}</option>
              {entregadores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </CampoSelect>

            <CampoSelect
              t={t}
              label={t("relatorio.filtro.periodo")}
              value={periodo}
              onChange={(value) =>
                setPeriodo(value as FiltroRelatorioEntregas["periodo"])
              }
            >
              <option value="pedido">{t("relatorio.comum.dataPedido")}</option>
              <option value="finalizado">{t("relatorio.filtro.dataFim")}</option>
            </CampoSelect>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("relatorio.comum.dataInicio")}</label>
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
              <label className={labelClass}>{t("relatorio.comum.dataFinal")}</label>
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

          <p className="mt-3 text-[11px] text-slate-500">
            {t("relatorio.entregas.resumoPeriodo", { total: totalFiltrado })}
          </p>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => void imprimir()}
              disabled={gerando}
              className="h-10 w-full rounded-sm bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {gerando ? t("relatorio.gerando") : t("relatorio.imprimir")}
            </button>
            <button
              type="button"
              onClick={() => void exportar()}
              disabled={gerando}
              className="h-10 w-full rounded-sm border border-[#4cae4c] bg-[#f0fdf4] text-[13px] font-normal text-[#16a34a] hover:bg-[#dcfce7] disabled:opacity-60"
            >
              {t("relatorio.exportarCsv")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-sm border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50"
            >
              {t("cadastros.comum.fechar")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}
