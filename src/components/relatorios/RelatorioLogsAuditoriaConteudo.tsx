"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Home, Search } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { PainelCarregando } from "@/components/ListaCarregando";
import { BadgeTipoAlteracaoLog } from "@/components/relatorios/BadgeTipoAlteracaoLog";
import { VerAlteracoesAuditoriaModal } from "@/components/relatorios/VerAlteracoesAuditoriaModal";
import { dateToBrShort } from "@/lib/datas-br";
import {
  aplicarPeriodoLogsAuditoria,
  CATEGORIAS_LOG_AUDITORIA,
  labelFiltroReferencia,
  layoutTabelaLogsAuditoria,
  type LogAuditoriaLinha,
  rotuloOpcaoLog,
  textoClienteLog,
  textoClienteLogFinanceiro,
  textoParcelaLog,
  textoServicoLog,
  TIPOS_ALTERACAO_LOG,
} from "@/lib/logs-auditoria";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";
const inputDataClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white text-[12px] text-[#374151] shadow-none focus:border-[#4a90d9] focus:ring-0";
const thClass =
  "px-2 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]";
const tdClass = "px-2 py-2.5 text-center align-middle text-[12px] text-[#374151]";

function hojeBr() {
  return dateToBrShort(new Date());
}

export function RelatorioLogsAuditoriaConteudo() {
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState<LogAuditoriaLinha[]>([]);
  const [categoria, setCategoria] = useState("os");
  const [tipoAlteracao, setTipoAlteracao] = useState("todos");
  const [referencia, setReferencia] = useState("");
  const [periodo, setPeriodo] = useState("hoje");
  const [dataInicio, setDataInicio] = useState(hojeBr);
  const [dataFim, setDataFim] = useState(hojeBr);
  const [linhaDetalhe, setLinhaDetalhe] = useState<LogAuditoriaLinha | null>(null);

  const layout = useMemo(() => layoutTabelaLogsAuditoria(categoria), [categoria]);
  const labelReferencia = useMemo(() => labelFiltroReferencia(categoria), [categoria]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        categoria,
        tipoAlteracao,
        referencia,
        periodo,
        dataInicio,
        dataFim,
      });
      const res = await fetch(`/api/relatorios/logs-auditoria?${params}`, {
        cache: "no-store",
      });
      const data = res.ok ? await res.json() : { linhas: [] };
      setLinhas(Array.isArray(data.linhas) ? data.linhas : []);
    } catch {
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  }, [categoria, tipoAlteracao, referencia, periodo, dataInicio, dataFim]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void carregar();
    }, referencia ? 400 : 0);
    return () => window.clearTimeout(t);
  }, [carregar, referencia]);

  function onPeriodoChange(value: string) {
    setPeriodo(value);
    const { dataInicio: ini, dataFim: fim } = aplicarPeriodoLogsAuditoria(value);
    if (value !== "outro") {
      setDataInicio(ini || hojeBr());
      setDataFim(fim || hojeBr());
    }
    if (value === "todos") {
      setDataInicio("");
      setDataFim("");
    }
  }

  const colSpan =
    layout === "etapas" ? 8 : layout === "os" ? 6 : 7;

  return (
    <div className="relatorio-logs-auditoria bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280]">Relatórios</h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[#6b7280]">Logs (auditoria)</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="overflow-visible rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
          <div className="px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-2">
                <label className={labelClass}>Categoria</label>
                <div className="relative">
                  <select
                    className={cn(selectClass, "appearance-none pr-8")}
                    value={categoria}
                    onChange={(e) => {
                      setCategoria(e.target.value);
                      setReferencia("");
                    }}
                  >
                    {CATEGORIAS_LOG_AUDITORIA.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                </div>
              </div>
              <div className="lg:col-span-2">
                <label className={labelClass}>Tipo Alteração</label>
                <div className="relative">
                  <select
                    className={cn(selectClass, "appearance-none pr-8")}
                    value={tipoAlteracao}
                    onChange={(e) => setTipoAlteracao(e.target.value)}
                  >
                    {TIPOS_ALTERACAO_LOG.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                </div>
              </div>
              <div className="lg:col-span-2">
                <label className={labelClass}>{labelReferencia}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) =>
                      setReferencia(
                        layout === "financeiro"
                          ? e.target.value.toUpperCase()
                          : e.target.value.replace(/\D/g, "")
                      )
                    }
                    className={cn(selectClass, "pr-9")}
                  />
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                </div>
              </div>
              <div className="lg:col-span-6">
                <label className={labelClass}>Período</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[120px] flex-1">
                    <select
                      className={cn(selectClass, "appearance-none pr-8")}
                      value={periodo}
                      onChange={(e) => onPeriodoChange(e.target.value)}
                    >
                      <option value="hoje">Hoje</option>
                      <option value="semana">Esta Semana</option>
                      <option value="mes">Este Mês</option>
                      <option value="proximos30">Próximos 30 dias</option>
                      <option value="todos">Mostrar Todos</option>
                      <option value="outro">Outro Período</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  </div>
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataClass}
                    onValueChange={() => setPeriodo("outro")}
                  />
                  <CampoDataBr
                    value={dataFim}
                    onChange={setDataFim}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataClass}
                    onValueChange={() => setPeriodo("outro")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
          {carregando ? (
            <div className="min-h-[320px]">
              <PainelCarregando mensagem="Carregando logs de auditoria..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#f3f4f6]">
                    {layout === "etapas" && (
                      <>
                        <th className={thClass}>OS</th>
                        <th className={thClass}>SERVIÇO</th>
                        <th className={thClass}>ETAPA</th>
                        <th className={thClass}>COLABORADOR</th>
                      </>
                    )}
                    {layout === "os" && (
                      <>
                        <th className={thClass}>OS</th>
                        <th className={thClass}>SERVIÇO</th>
                        <th className={thClass}>CLIENTE</th>
                      </>
                    )}
                    {layout === "financeiro" && (
                      <>
                        <th className={thClass}>FATURA</th>
                        <th className={thClass}>PARCELA</th>
                        <th className={thClass}>CLIENTE</th>
                      </>
                    )}
                    <th className={thClass}>DATA ALTERAÇÃO</th>
                    <th className={thClass}>USUÁRIO</th>
                    <th className={thClass}>TIPO ALTERAÇÃO</th>
                    <th className={thClass}>OPÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="h-[280px] text-center text-[#9ca3af]">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    linhas.map((linha, idx) => (
                      <tr
                        key={linha.id}
                        className={cn(
                          "border-t border-[#f3f4f6]",
                          idx % 2 === 1 ? "bg-[#fafafa]" : "bg-white"
                        )}
                      >
                        {layout === "financeiro" && (
                          <>
                            <td className={tdClass}>{linha.numeroFatura ?? "—"}</td>
                            <td className={tdClass}>
                              {textoParcelaLog(linha.parcelaNumero, linha.parcelaTotal)}
                            </td>
                          </>
                        )}
                        {layout === "etapas" && (
                          <>
                            <td className={tdClass}>{linha.numeroOs ?? "—"}</td>
                            <td className={cn(tdClass, "max-w-[140px] truncate")}>
                              {linha.servico || "—"}
                            </td>
                            <td className={tdClass}>{linha.etapa || "—"}</td>
                            <td className={cn(tdClass, "max-w-[160px] truncate")}>
                              {linha.colaborador || "—"}
                            </td>
                          </>
                        )}
                        {layout === "os" && (
                          <>
                            <td className={tdClass}>{linha.numeroOs ?? "—"}</td>
                            <td
                              className={cn(tdClass, "max-w-[220px] truncate")}
                              title={textoServicoLog(linha)}
                            >
                              {textoServicoLog(linha)}
                            </td>
                            <td
                              className={cn(tdClass, "max-w-[220px] truncate")}
                              title={textoClienteLog(linha)}
                            >
                              {textoClienteLog(linha)}
                            </td>
                          </>
                        )}
                        {layout === "financeiro" && (
                          <td
                            className={cn(tdClass, "max-w-[220px] truncate")}
                            title={textoClienteLogFinanceiro(linha)}
                          >
                            {textoClienteLogFinanceiro(linha)}
                          </td>
                        )}
                        <td className={cn(tdClass, "whitespace-nowrap")}>
                          {linha.dataAlteracaoFormatada}
                        </td>
                        <td className={tdClass}>{linha.usuarioNome}</td>
                        <td className={tdClass}>
                          <BadgeTipoAlteracaoLog tipo={linha.tipoAlteracao} />
                        </td>
                        <td className={tdClass}>
                          <button
                            type="button"
                            onClick={() => setLinhaDetalhe(linha)}
                            className="text-[12px] font-medium text-[#4a90d9] hover:underline"
                          >
                            {rotuloOpcaoLog(linha.tipoAlteracao)}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <VerAlteracoesAuditoriaModal linha={linhaDetalhe} onFechar={() => setLinhaDetalhe(null)} />
    </div>
  );
}
