"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Info,
  Percent,
  Timer,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CampoDataBr } from "@/components/campo-data-br";
import { useI18n } from "@/components/i18n-provider";
import { PaginacaoLista } from "@/components/listagem/PaginacaoLista";
import { PainelCarregando } from "@/components/ListaCarregando";
import { Button, Modal } from "@/components/ui";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import {
  exportarServicosNaoConcluidosCsv,
  exportarServicosNaoConcluidosExcel,
  exportarServicosNaoConcluidosPdf,
} from "@/lib/relatorio-servicos-nao-concluidos-export";
import {
  filtrosPadraoServicosNaoConcluidos,
  formatarMoedaServicosNaoConcluidos,
  formatarPercentualServicosNaoConcluidos,
  normalizarPeriodoFiltrosServicosNaoConcluidos,
  periodoFiltroServicosNaoConcluidosValido,
  type EtapaGrupoRelatorio,
  type FiltrosServicosNaoConcluidos,
  type RelatorioServicosNaoConcluidosPayload,
  type ServicoVencido,
} from "@/lib/relatorio-servicos-nao-concluidos";

const PREVIEW_TABELA = 10;
const LINHAS_POR_PAGINA_MODAL = 20;

const inputDataClass =
  "h-[36px] w-full rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 text-[12px] text-[#374151] dark:text-slate-200 shadow-none outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20";

const COR_ETAPA: Record<EtapaGrupoRelatorio, string> = {
  Montagem: "#8b5cf6",
  Acrilização: "#10b981",
  "Plano de Cera": "#f97316",
  Acabamento: "#3b82f6",
  Ceroplastia: "#ec4899",
  Outras: "#9ca3af",
};

const COR_GRAFICO = {
  roxo: "#8b5cf6",
  grid: "#e8e8e8",
  texto: "#6b7280",
} as const;

function CardKpi({
  titulo,
  subtitulo,
  valor,
  icone,
  corValor,
  corIcone,
  corFundoIcone,
}: {
  titulo: string;
  subtitulo?: string;
  valor: string;
  icone: React.ReactNode;
  corValor: string;
  corIcone: string;
  corFundoIcone: string;
}) {
  return (
    <div className="rounded-xl border border-[#e8eaed] bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#6b7280] dark:text-slate-400">{titulo}</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums" style={{ color: corValor }}>
            {valor}
          </p>
          {subtitulo ? (
            <p className="mt-1 text-[11px] text-[#9ca3af] dark:text-slate-500">{subtitulo}</p>
          ) : null}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: corFundoIcone, color: corIcone }}
        >
          {icone}
        </div>
      </div>
    </div>
  );
}

function CardGrafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#e8eaed] bg-white dark:bg-slate-900 shadow-sm">
      <div className="border-b border-[#f0f0f0] dark:border-slate-700 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[#374151] dark:text-slate-200">{titulo}</h3>
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

function CardTabela({
  titulo,
  children,
  onVerTodos,
  t,
}: {
  titulo: string;
  children: React.ReactNode;
  onVerTodos?: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#e8eaed] bg-white dark:bg-slate-900 shadow-sm">
      <div className="border-b border-[#f0f0f0] dark:border-slate-700 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[#374151] dark:text-slate-200">{titulo}</h3>
      </div>
      <div className="flex-1 overflow-x-auto px-2 py-2">{children}</div>
      {onVerTodos ? (
        <div className="border-t border-[#f0f0f0] dark:border-slate-700 px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={onVerTodos}
            className="text-[12px] font-medium text-[#4a90d9] hover:underline"
          >
            {t("relatorio.comum.verTodos")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NomePaciente({ nome }: { nome: string }) {
  if (!nome.trim() || nome.trim() === "—") return null;
  return <p className="mt-0.5 text-[11px] font-normal text-[#6b7280] dark:text-slate-400">{nome}</p>;
}

function BotaoOs({
  numero,
  onClick,
}: {
  numero: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-[#4a90d9] hover:underline"
    >
      {numero}
    </button>
  );
}

function CampoResumoOs({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-slate-500">
        {rotulo}
      </p>
      <p className="mt-0.5 text-[13px] text-[#374151] dark:text-slate-200">{valor || "—"}</p>
    </div>
  );
}

function ModalOsSimplificada({
  os,
  onClose,
}: {
  os: ServicoVencido | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!os) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t("relatorio.comum.os")} ${os.numeroOs}`}
      size="md"
      layerClassName="z-[60]"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoResumoOs rotulo={t("relatorio.comum.cliente")} valor={os.cliente} />
          <CampoResumoOs rotulo={t("relatorio.comum.paciente")} valor={os.paciente} />
          <CampoResumoOs rotulo={t("relatorio.comum.servico")} valor={os.servico} />
          <CampoResumoOs rotulo={t("relatorio.comum.etapaAtual")} valor={os.etapaAtual} />
          <CampoResumoOs rotulo={t("relatorio.comum.situacao")} valor={os.situacao} />
          <CampoResumoOs rotulo={t("relatorio.comum.responsavel")} valor={os.responsavel} />
          <CampoResumoOs rotulo={t("relatorio.comum.dataPedido")} valor={os.dataEntrada} />
          <CampoResumoOs rotulo={t("dashboard.prazoLab")} valor={os.prazo} />
          <CampoResumoOs
            rotulo={t("relatorio.comum.diasAtraso")}
            valor={t("relatorio.comum.dias", { n: os.diasAtraso })}
          />
          <CampoResumoOs
            rotulo={t("relatorio.comum.valor")}
            valor={formatarMoedaServicosNaoConcluidos(os.valor)}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#f0f0f0] pt-4 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("dashboard.fechar")}
          </Button>
          <Link
            href={`/app/producao/controle?editar=${os.id}`}
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            onClick={onClose}
          >
            {t("dashboard.verOsCompleta")}
          </Link>
        </div>
      </div>
    </Modal>
  );
}

function SemDados({ t }: { t: ReturnType<typeof useI18n>["t"] }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-[12px] text-[#9ca3af] dark:text-slate-500">
      {t("relatorio.comum.semDadosPeriodo")}
    </div>
  );
}

export function ServicosNaoConcluidosConteudo() {
  const { t, locale } = useI18n();
  const padrao = filtrosPadraoServicosNaoConcluidos();
  const [filtros, setFiltros] = useState<FiltrosServicosNaoConcluidos>(padrao);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosServicosNaoConcluidos>(padrao);
  const [dados, setDados] = useState<RelatorioServicosNaoConcluidosPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [listaAberta, setListaAberta] = useState<"clientes" | "vencidos" | null>(null);
  const [paginaLista, setPaginaLista] = useState(1);
  const [osAberta, setOsAberta] = useState<ServicoVencido | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        dataInicio: filtrosAplicados.dataInicio,
        dataFim: filtrosAplicados.dataFim,
      });
      const res = await fetch(`/api/relatorios/servicos-nao-concluidos?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Falha");
      setDados((await res.json()) as RelatorioServicosNaoConcluidosPayload);
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [filtrosAplicados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aplicarFiltros(proximo?: FiltrosServicosNaoConcluidos) {
    const bruto = proximo ?? filtros;
    const normalizado = normalizarPeriodoFiltrosServicosNaoConcluidos(bruto);
    if (!periodoFiltroServicosNaoConcluidosValido(normalizado)) return;
    setFiltros(normalizado);
    setFiltrosAplicados(normalizado);
  }

  function aoAlterarData(campo: "dataInicio" | "dataFim", valor: string) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  function aoConfirmarData(campo: "dataInicio" | "dataFim", valor: string) {
    setFiltros((atual) => {
      const proximo = normalizarPeriodoFiltrosServicosNaoConcluidos({
        ...atual,
        [campo]: valor,
      });
      if (periodoFiltroServicosNaoConcluidosValido(proximo)) {
        setFiltrosAplicados(proximo);
      }
      return proximo;
    });
  }

  async function exportar(tipo: "pdf" | "excel" | "csv") {
    if (!dados) return;
    setExportando(true);
    try {
      if (tipo === "pdf") {
        await abrirPdfGerando(() =>
          exportarServicosNaoConcluidosPdf(dados, filtrosAplicados, { locale })
        );
      } else if (tipo === "excel") {
        exportarServicosNaoConcluidosExcel(dados, filtrosAplicados);
      } else {
        exportarServicosNaoConcluidosCsv(dados, filtrosAplicados);
      }
    } finally {
      setExportando(false);
    }
  }

  const dadosPizza =
    dados?.quantidadePorEtapa.map((e) => ({
      nome: e.etapa,
      valor: e.quantidade,
      percentual: e.percentual,
      cor: COR_ETAPA[e.etapa],
    })) ?? [];

  const dadosBarrasHorizontais =
    dados?.valorPorEtapa.map((e) => ({
      nome: e.etapa,
      valor: e.valor,
      cor: COR_ETAPA[e.etapa],
    })) ?? [];

  const clientesPreview = useMemo(
    () => dados?.porCliente.slice(0, PREVIEW_TABELA) ?? [],
    [dados]
  );
  const vencidosPreview = useMemo(
    () => dados?.vencidos.slice(0, PREVIEW_TABELA) ?? [],
    [dados]
  );
  const maiorTempoClientes = dados
    ? Math.max(...dados.porCliente.map((c) => c.maiorTempoParado), 0)
    : 0;
  const valorVencidos = dados?.vencidos.reduce((s, v) => s + v.valor, 0) ?? 0;
  const itensLista =
    listaAberta === "clientes" ? (dados?.porCliente.length ?? 0) : (dados?.vencidos.length ?? 0);
  const totalPaginasLista = Math.max(1, Math.ceil(itensLista / LINHAS_POR_PAGINA_MODAL));
  const paginaListaAtual = Math.min(paginaLista, totalPaginasLista);
  const inicioPagina = (paginaListaAtual - 1) * LINHAS_POR_PAGINA_MODAL;
  const fimPagina = Math.min(inicioPagina + LINHAS_POR_PAGINA_MODAL, itensLista);
  const clientesPagina =
    dados?.porCliente.slice(inicioPagina, inicioPagina + LINHAS_POR_PAGINA_MODAL) ?? [];
  const vencidosPagina =
    dados?.vencidos.slice(inicioPagina, inicioPagina + LINHAS_POR_PAGINA_MODAL) ?? [];

  function abrirLista(qual: "clientes" | "vencidos") {
    setPaginaLista(1);
    setListaAberta(qual);
  }

  return (
    <div className="min-h-[100vh] w-full bg-[#f4f6f8]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-2">
          <Link
            href="/app/relatorios"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#6b7280] dark:text-slate-400 hover:text-[#374151] dark:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("relatorio.voltar")}
          </Link>
        </div>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-[#1f2937] dark:text-slate-100 sm:text-[22px]">
              {t("relatorio.snc.tituloPagina")}
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-[#6b7280] dark:text-slate-400">
              {t("relatorio.snc.subtituloPagina")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[130px]">
              <CampoDataBr
                value={filtros.dataInicio}
                onChange={(dataInicio) => aoAlterarData("dataInicio", dataInicio)}
                onValueChange={(dataInicio) => aoConfirmarData("dataInicio", dataInicio)}
                placeholder="dd/mm/aaaa"
                iconPosition="left"
                className="space-y-0"
                inputClassName={inputDataClass}
              />
            </div>
            <span className="pb-2 text-[12px] text-[#9ca3af] dark:text-slate-500">—</span>
            <div className="w-[130px]">
              <CampoDataBr
                value={filtros.dataFim}
                onChange={(dataFim) => aoAlterarData("dataFim", dataFim)}
                onValueChange={(dataFim) => aoConfirmarData("dataFim", dataFim)}
                placeholder="dd/mm/aaaa"
                iconPosition="left"
                className="space-y-0"
                inputClassName={inputDataClass}
              />
            </div>
            <button
              type="button"
              onClick={() => aplicarFiltros()}
              className="inline-flex h-[36px] items-center gap-1.5 rounded-lg bg-[#8b5cf6] px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-[#7c3aed]"
            >
              <Filter className="h-3.5 w-3.5" />
              {t("relatorio.filtrar")}
            </button>
            <div className="relative">
              <button
                type="button"
                disabled={!dados || exportando}
                onClick={() => void exportar("csv")}
                className="inline-flex h-[36px] items-center gap-1.5 rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[12px] font-medium text-[#374151] dark:text-slate-200 shadow-sm hover:bg-[#f9fafb] dark:bg-slate-800/70 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {t("relatorio.comum.exportar")}
              </button>
            </div>
          </div>
        </header>

        {carregando ? (
          <div className="min-h-[400px] rounded-xl border border-[#e8eaed] bg-white dark:bg-slate-900 shadow-sm">
            <PainelCarregando mensagem={t("relatorio.carregando")} />
          </div>
        ) : !dados ? (
          <div className="rounded-xl border border-[#e8eaed] bg-white dark:bg-slate-900 p-12 text-center text-[#6b7280] dark:text-slate-400">
            {t("relatorio.erroCarregar")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <CardKpi
                titulo={t("relatorio.snc.titulo")}
                subtitulo={t("relatorio.snc.subtituloTotal")}
                valor={String(dados.resumo.quantidade)}
                icone={<ClipboardList className="h-5 w-5" />}
                corValor="#8b5cf6"
                corIcone="#8b5cf6"
                corFundoIcone="#ede9fe"
              />
              <CardKpi
                titulo={t("relatorio.snc.valorTotalPreso")}
                subtitulo={t("relatorio.snc.subtituloValorPreso")}
                valor={formatarMoedaServicosNaoConcluidos(dados.resumo.valorTotalPreso)}
                icone={<Wallet className="h-5 w-5" />}
                corValor="#10b981"
                corIcone="#10b981"
                corFundoIcone="#d1fae5"
              />
              <CardKpi
                titulo={t("relatorio.snc.tempoMedioParado")}
                subtitulo={t("relatorio.snc.subtituloTempoMedio")}
                valor={t("relatorio.comum.dias", { n: dados.resumo.tempoMedioParado })}
                icone={<Timer className="h-5 w-5" />}
                corValor="#f97316"
                corIcone="#f97316"
                corFundoIcone="#ffedd5"
              />
              <CardKpi
                titulo={t("relatorio.snc.servicosVencidos")}
                subtitulo={t("relatorio.snc.subtituloVencidos")}
                valor={String(dados.resumo.servicosVencidos)}
                icone={<AlertTriangle className="h-5 w-5" />}
                corValor="#ef4444"
                corIcone="#ef4444"
                corFundoIcone="#fee2e2"
              />
              <CardKpi
                titulo={t("relatorio.snc.percentualProducao")}
                subtitulo={t("relatorio.snc.subtituloPercentual")}
                valor={formatarPercentualServicosNaoConcluidos(dados.resumo.percentualProducao)}
                icone={<Percent className="h-5 w-5" />}
                corValor="#3b82f6"
                corIcone="#3b82f6"
                corFundoIcone="#dbeafe"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <CardGrafico titulo={t("relatorio.snc.graficoValorPorMes")}>
                {dados.valorPorMes.length === 0 ? (
                  <SemDados t={t} />
                ) : (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dados.valorPorMes}
                        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={COR_GRAFICO.grid} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: COR_GRAFICO.texto }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: COR_GRAFICO.texto }}
                          tickFormatter={(v) =>
                            Number(v).toLocaleString("pt-BR", {
                              notation: "compact",
                              compactDisplay: "short",
                            })
                          }
                        />
                        <Tooltip
                          formatter={(valor) => [
                            formatarMoedaServicosNaoConcluidos(Number(valor ?? 0)),
                            t("relatorio.comum.valor"),
                          ]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar
                          dataKey="valor"
                          fill={COR_GRAFICO.roxo}
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardGrafico>

              <CardGrafico titulo={t("relatorio.snc.graficoPorEtapa")}>
                {dadosPizza.length === 0 ? (
                  <SemDados t={t} />
                ) : (
                  <div className="flex h-[260px] flex-col items-center">
                    <ResponsiveContainer width="100%" height="75%">
                      <PieChart>
                        <Pie
                          data={dadosPizza}
                          dataKey="valor"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {dadosPizza.map((entry) => (
                            <Cell key={entry.nome} fill={entry.cor} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(valor, _nome, props) => {
                            const pct = (props?.payload as { percentual?: number })?.percentual;
                            return [
                              t("relatorio.comum.servicosComPct", {
                                n: Number(valor ?? 0),
                                pct: pct != null ? pct.toFixed(1) : "0",
                              }),
                              t("relatorio.comum.quantidade"),
                            ];
                          }}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
                      {dadosPizza.map((e) => (
                        <span
                          key={e.nome}
                          className="inline-flex items-center gap-1 text-[10px] text-[#6b7280] dark:text-slate-400"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: e.cor }}
                          />
                          {e.nome} ({e.percentual.toFixed(0)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardGrafico>

              <CardGrafico titulo={t("relatorio.snc.graficoValorPorEtapa")}>
                {dadosBarrasHorizontais.length === 0 ? (
                  <SemDados t={t} />
                ) : (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dadosBarrasHorizontais}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={COR_GRAFICO.grid}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: COR_GRAFICO.texto }}
                          tickFormatter={(v) =>
                            Number(v).toLocaleString("pt-BR", {
                              notation: "compact",
                              compactDisplay: "short",
                            })
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          width={100}
                          tick={{ fontSize: 10, fill: COR_GRAFICO.texto }}
                        />
                        <Tooltip
                          formatter={(valor) => [
                            formatarMoedaServicosNaoConcluidos(Number(valor ?? 0)),
                            t("relatorio.comum.valor"),
                          ]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={16}>
                          {dadosBarrasHorizontais.map((entry) => (
                            <Cell key={entry.nome} fill={entry.cor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardGrafico>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <CardTabela
                titulo={t("relatorio.snc.tabelaPorCliente")}
                onVerTodos={() => abrirLista("clientes")}
                t={t}
              >
                <table className="w-full min-w-[420px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] dark:text-slate-500">
                      <th className="px-2 py-2">{t("relatorio.comum.cliente")}</th>
                      <th className="px-2 py-2 text-center">{t("relatorio.comum.qtdeServicos")}</th>
                      <th className="px-2 py-2 text-right">{t("relatorio.comum.valorTotal")}</th>
                      <th className="px-2 py-2 text-center">{t("relatorio.comum.tempoMedioParado")}</th>
                      <th className="px-2 py-2 text-center">{t("relatorio.comum.maiorTempoParado")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesPreview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-[#9ca3af] dark:text-slate-500">
                          {t("relatorio.snc.semServicosPeriodo")}
                        </td>
                      </tr>
                    ) : (
                      clientesPreview.map((c) => (
                        <tr key={c.cliente} className="border-b border-[#f8f8f8] last:border-0">
                          <td className="px-2 py-2.5 font-medium text-[#374151] dark:text-slate-200">{c.cliente}</td>
                          <td className="px-2 py-2.5 text-center tabular-nums">{c.quantidade}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums">
                            {formatarMoedaServicosNaoConcluidos(c.valorTotal)}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums">
                            {t("relatorio.comum.dias", { n: c.tempoMedioParado })}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums">
                            {t("relatorio.comum.dias", { n: c.maiorTempoParado })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {clientesPreview.length > 0 ? (
                    <tfoot>
                      <tr className="bg-[#f9fafb] dark:bg-slate-800/70 font-semibold text-[#374151] dark:text-slate-200">
                        <td className="px-2 py-2.5">{t("relatorio.kpi.total")}</td>
                        <td className="px-2 py-2.5 text-center">{dados.resumo.quantidade}</td>
                        <td className="px-2 py-2.5 text-right text-[#10b981]">
                          {formatarMoedaServicosNaoConcluidos(dados.resumo.valorTotalPreso)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {t("relatorio.comum.dias", { n: dados.resumo.tempoMedioParado })}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {t("relatorio.comum.dias", { n: maiorTempoClientes })}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </CardTabela>

              <CardTabela
                titulo={t("relatorio.snc.tabelaVencidos")}
                onVerTodos={() => abrirLista("vencidos")}
                t={t}
              >
                <table className="w-full min-w-[380px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] dark:text-slate-500">
                      <th className="px-2 py-2">{t("relatorio.comum.os")}</th>
                      <th className="px-2 py-2">{t("relatorio.comum.cliente")}</th>
                      <th className="px-2 py-2">{t("relatorio.comum.etapaAtual")}</th>
                      <th className="px-2 py-2 text-center">{t("relatorio.comum.diasAtraso")}</th>
                      <th className="px-2 py-2 text-right">{t("relatorio.comum.valor")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vencidosPreview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-[#9ca3af] dark:text-slate-500">
                          {t("relatorio.snc.semVencidosPeriodo")}
                        </td>
                      </tr>
                    ) : (
                      vencidosPreview.map((v) => (
                        <tr
                          key={v.id}
                          className="border-b border-[#f8f8f8] last:border-0"
                        >
                          <td className="px-2 py-2.5">
                            <BotaoOs numero={v.numeroOs} onClick={() => setOsAberta(v)} />
                          </td>
                          <td className="px-2 py-2.5 text-[#374151] dark:text-slate-200">
                            <span className="font-medium">{v.cliente}</span>
                            <NomePaciente nome={v.paciente} />
                          </td>
                          <td className="px-2 py-2.5 text-[#6b7280] dark:text-slate-400">{v.etapaAtual}</td>
                          <td className="px-2 py-2.5 text-center font-semibold text-[#ef4444]">
                            {t("relatorio.comum.dias", { n: v.diasAtraso })}
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold text-[#ef4444]">
                            {formatarMoedaServicosNaoConcluidos(v.valor)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {vencidosPreview.length > 0 ? (
                    <tfoot>
                      <tr className="bg-[#f9fafb] dark:bg-slate-800/70 font-semibold text-[#374151] dark:text-slate-200">
                        <td colSpan={3} className="px-2 py-2.5">
                          {t("relatorio.comum.totalVencidos")}
                        </td>
                        <td className="px-2 py-2.5 text-center text-[#ef4444]">
                          {dados.resumo.servicosVencidos}
                        </td>
                        <td className="px-2 py-2.5 text-right text-[#ef4444]">
                          {formatarMoedaServicosNaoConcluidos(valorVencidos)}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </CardTabela>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] dark:text-slate-500">
              <Info className="h-3.5 w-3.5" />
              {t("relatorio.comum.relatorioGeradoEm", { data: dados.geradoEm })}
              <span className="mx-1">·</span>
              <CalendarDays className="h-3.5 w-3.5" />
              {t("relatorio.filtro.periodo")}: {dados.periodoLabel}
              <span className="mx-1">·</span>
              <Clock className="h-3.5 w-3.5" />
              {t("relatorio.comum.servicosAtivosNota")}
            </p>
          </div>
        )}

        {dados && listaAberta ? (
          <Modal
            open
            onClose={() => setListaAberta(null)}
            title={
              listaAberta === "clientes"
                ? t("relatorio.snc.tabelaPorCliente")
                : t("relatorio.snc.tabelaVencidos")
            }
            size="xl"
          >
            {itensLista === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9ca3af] dark:text-slate-500">
                {listaAberta === "clientes"
                  ? t("relatorio.snc.semServicosPeriodo")
                  : t("relatorio.snc.semVencidosPeriodo")}
              </p>
            ) : listaAberta === "clientes" ? (
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#f0f0f0] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] dark:border-slate-700 dark:text-slate-500">
                    <th className="px-2 py-2">{t("relatorio.comum.cliente")}</th>
                    <th className="px-2 py-2 text-center">{t("relatorio.comum.qtdeServicos")}</th>
                    <th className="px-2 py-2 text-right">{t("relatorio.comum.valorTotal")}</th>
                    <th className="px-2 py-2 text-center">{t("relatorio.comum.tempoMedioParado")}</th>
                    <th className="px-2 py-2 text-center">{t("relatorio.comum.maiorTempoParado")}</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPagina.map((c) => (
                    <tr key={c.cliente} className="border-b border-[#f8f8f8] last:border-0 dark:border-slate-800">
                      <td className="px-2 py-2.5 font-medium text-[#374151] dark:text-slate-200">{c.cliente}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{c.quantidade}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {formatarMoedaServicosNaoConcluidos(c.valorTotal)}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums">
                        {t("relatorio.comum.dias", { n: c.tempoMedioParado })}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums">
                        {t("relatorio.comum.dias", { n: c.maiorTempoParado })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#f0f0f0] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] dark:border-slate-700 dark:text-slate-500">
                    <th className="px-2 py-2">{t("relatorio.comum.os")}</th>
                    <th className="px-2 py-2">{t("relatorio.comum.cliente")}</th>
                    <th className="px-2 py-2">{t("relatorio.comum.etapaAtual")}</th>
                    <th className="px-2 py-2 text-center">{t("relatorio.comum.diasAtraso")}</th>
                    <th className="px-2 py-2 text-right">{t("relatorio.comum.valor")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vencidosPagina.map((v) => (
                    <tr key={v.id} className="border-b border-[#f8f8f8] last:border-0 dark:border-slate-800">
                      <td className="px-2 py-2.5">
                        <BotaoOs numero={v.numeroOs} onClick={() => setOsAberta(v)} />
                      </td>
                      <td className="px-2 py-2.5 text-[#374151] dark:text-slate-200">
                        <span className="font-medium">{v.cliente}</span>
                        <NomePaciente nome={v.paciente} />
                      </td>
                      <td className="px-2 py-2.5 text-[#6b7280] dark:text-slate-400">{v.etapaAtual}</td>
                      <td className="px-2 py-2.5 text-center font-semibold text-[#ef4444]">
                        {t("relatorio.comum.dias", { n: v.diasAtraso })}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold text-[#ef4444]">
                        {formatarMoedaServicosNaoConcluidos(v.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {itensLista > 0 ? (
              <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
                <p className="text-[12px] text-[#6b7280] dark:text-slate-400">
                  {t("relatorio.comum.registrosIntervalo", {
                    de: inicioPagina + 1,
                    ate: fimPagina,
                    total: itensLista,
                  })}
                </p>
                <PaginacaoLista
                  pagina={paginaListaAtual}
                  totalPaginas={totalPaginasLista}
                  onPagina={setPaginaLista}
                  className="border-0 py-0"
                />
              </div>
            ) : null}
          </Modal>
        ) : null}

        <ModalOsSimplificada os={osAberta} onClose={() => setOsAberta(null)} />
      </div>
    </div>
  );
}
