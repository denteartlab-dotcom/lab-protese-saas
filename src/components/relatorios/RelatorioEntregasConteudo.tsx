"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { CampoDataBr } from "@/components/campo-data-br";
import { RelatorioCabecalho } from "@/components/relatorios/RelatorioCabecalho";
import { PainelCarregando } from "@/components/ListaCarregando";
import {
  ENTREGAS_EVENT,
  SITUACOES_ENTREGA,
  carregarEntregadores,
  carregarEntregas,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import {
  MODELOS_RELATORIO_ENTREGAS,
  carregarTrabalhosParaRelatorioEntregas,
  exportarRelatorioEntregasCsv,
  filtrosRelatorioPadraoEntregas,
  gerarLinhasRelatorioEntregas,
  imprimirRelatorioEntregas,
  type FiltroRelatorioEntregas,
  type LinhaRelatorioEntrega,
} from "@/lib/relatorio-entregas";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";
const dataInputClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white pl-8 pr-2 text-[12px] text-[#374151] shadow-none focus:border-[#4a90d9] focus:ring-0";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function RelatorioEntregasConteudo() {
  const { t } = useI18n();
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [entregas, setEntregas] = useState<EntregaControle[]>([]);
  const [entregadores, setEntregadores] = useState<string[]>([]);
  const [gerado, setGerado] = useState(false);
  const [linhas, setLinhas] = useState<LinhaRelatorioEntrega[]>([]);

  const padrao = filtrosRelatorioPadraoEntregas();
  const [modelo, setModelo] = useState(padrao.modelo);
  const [ordenarPor, setOrdenarPor] = useState(padrao.ordenarPor);
  const [situacao, setSituacao] = useState<"" | SituacaoEntrega>("");
  const [entregador, setEntregador] = useState("");
  const [periodo, setPeriodo] = useState(padrao.periodo);
  const [dataInicio, setDataInicio] = useState(padrao.dataInicio);
  const [dataFinal, setDataFinal] = useState(padrao.dataFinal);

  const recarregar = useCallback(() => {
    setEntregas(carregarEntregas());
    setEntregadores(carregarEntregadores());
  }, []);

  useEffect(() => {
    recarregar();
    setCarregando(false);
    window.addEventListener(ENTREGAS_EVENT, recarregar);
    return () => window.removeEventListener(ENTREGAS_EVENT, recarregar);
  }, [recarregar]);

  const filtro = useMemo<FiltroRelatorioEntregas>(
    () => ({
      modelo,
      ordenarPor,
      situacao,
      entregador,
      periodo,
      dataInicio,
      dataFinal,
      busca: "",
    }),
    [modelo, ordenarPor, situacao, entregador, periodo, dataInicio, dataFinal]
  );

  const totalValor = useMemo(
    () => linhas.reduce((soma, linha) => soma + linha.valor, 0),
    [linhas]
  );

  async function gerarRelatorio() {
    setGerando(true);
    try {
      const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
      const resultado = gerarLinhasRelatorioEntregas(entregas, filtro, trabalhos);
      setLinhas(resultado);
      setGerado(true);
    } finally {
      setGerando(false);
    }
  }

  async function imprimir() {
    setGerando(true);
    try {
      const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
      const resultado = gerarLinhasRelatorioEntregas(entregas, filtro, trabalhos);
      await imprimirRelatorioEntregas(resultado, filtro);
    } catch (err) {
      console.error("[relatorio-entregas] imprimir", err);
      alert(
        err instanceof Error && err.message
          ? err.message
          : t("relatorio.alerta.pdfErro")
      );
    } finally {
      setGerando(false);
    }
  }

  async function exportar() {
    setGerando(true);
    try {
      const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
      const resultado = gerarLinhasRelatorioEntregas(entregas, filtro, trabalhos);
      exportarRelatorioEntregasCsv(resultado, modelo);
    } finally {
      setGerando(false);
    }
  }

  if (carregando) return <PainelCarregando />;

  return (
    <div className="space-y-4 text-[12px] text-slate-700">
      <RelatorioCabecalho labelKey="nav.relatorio.controleEntregas" />

      <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className={labelClass}>Modelo Relatório</label>
            <select
              value={modelo}
              onChange={(e) =>
                setModelo(e.target.value as FiltroRelatorioEntregas["modelo"])
              }
              className={selectClass}
            >
              {MODELOS_RELATORIO_ENTREGAS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ordenar Por</label>
            <select
              value={ordenarPor}
              onChange={(e) =>
                setOrdenarPor(e.target.value as FiltroRelatorioEntregas["ordenarPor"])
              }
              className={selectClass}
            >
              <option value="data_pedido">Data Pedido</option>
              <option value="data_finalizado">Data Finalizado</option>
              <option value="destinatario">Destinatário</option>
              <option value="entregador">Entregador</option>
              <option value="valor">Valor</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Situação</label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as "" | SituacaoEntrega)}
              className={selectClass}
            >
              <option value="">Todos</option>
              {Object.entries(SITUACOES_ENTREGA).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className={labelClass}>Entregador</label>
            <select
              value={entregador}
              onChange={(e) => setEntregador(e.target.value)}
              className={selectClass}
            >
              <option value="">Todos</option>
              {entregadores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("relatorio.filtro.periodo")}</label>
            <select
              value={periodo}
              onChange={(e) =>
                setPeriodo(e.target.value as FiltroRelatorioEntregas["periodo"])
              }
              className={selectClass}
            >
              <option value="pedido">Data Pedido</option>
              <option value="finalizado">Data Finalizado</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Data Início</label>
            <CampoDataBr
              value={dataInicio}
              onChange={setDataInicio}
              iconPosition="left"
              className="space-y-0"
              inputClassName={dataInputClass}
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
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void gerarRelatorio()}
            disabled={gerando}
            className="rounded-sm bg-[#4a90d9] px-4 py-2 text-[12px] text-white hover:bg-[#3d7fc4] disabled:opacity-60"
          >
            {gerando ? t("relatorio.gerando") : t("relatorio.gerarRelatorio")}
          </button>
          <button
            type="button"
            onClick={() => void imprimir()}
            disabled={gerando}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#93c5fd] bg-[#dbeafe] px-3 py-2 text-[12px] text-[#2563eb] hover:bg-[#bfdbfe] disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" />
            {t("relatorio.imprimir")}
          </button>
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={gerando}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#86efac] bg-[#dcfce7] px-3 py-2 text-[12px] text-[#16a34a] hover:bg-[#bbf7d0] disabled:opacity-60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t("relatorio.exportarCsv")}
          </button>
        </div>
      </div>

      {gerado ? (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Data Pedido</th>
                <th className="px-3 py-2">Destinatário</th>
                <th className="px-3 py-2">Entregador</th>
                <th className="px-3 py-2">OS</th>
                <th className="px-3 py-2">Sit. OS</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma entrega encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                linhas.map((linha, indice) => (
                  <tr key={`${linha.destinatario}-${linha.dataPedido}-${indice}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{linha.dataPedido}</td>
                    <td className="px-3 py-2">{linha.destinatario}</td>
                    <td className="px-3 py-2">{linha.entregador}</td>
                    <td className="px-3 py-2">{linha.numeroOs}</td>
                    <td className="px-3 py-2">{linha.situacaoOs || "—"}</td>
                    <td className="px-3 py-2">{linha.situacaoLabel}</td>
                    <td className="px-3 py-2 text-right">{linha.valorLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
            {linhas.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                  <td colSpan={6} className="px-3 py-2 text-right">
                    Total ({linhas.length} registros)
                  </td>
                  <td className="px-3 py-2 text-right">R$ {money(totalValor)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
    </div>
  );
}
