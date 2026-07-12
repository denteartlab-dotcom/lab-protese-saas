"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  Flag,
  List,
  Printer,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  labelLinhaFluxoMensal,
  labelOpcaoFormaPagamentoFluxo,
  traduzirContaFluxo,
  traduzirDescricaoFluxo,
  traduzirFormaPagamentoFluxo,
} from "@/lib/i18n/relatorio-fluxo-i18n";
import { localeMoeda, nomeMesLocale } from "@/lib/i18n/relatorio-comum-i18n";
import { iniciarImpressaoRelatorio } from "@/lib/i18n/print-relatorio-helpers";
import { CampoDataBr } from "@/components/campo-data-br";
import { RelatorioCabecalho } from "@/components/relatorios/RelatorioCabecalho";
import {
  carregarContasBancarias,
  carregarMovimentacoesConta,
  type ContaBancaria,
} from "@/lib/conta-bancaria";
import {
  lerPreferenciasCookie,
  salvarPreferenciasCookie,
} from "@/lib/app-preferencias-cookie";
import { FINANCEIRO_ATUALIZADO_EVENT } from "@/lib/financeiro-events";
import { dateToBrShort } from "@/lib/datas-br";
import {
  calcularFluxoDeCaixa,
  calcularMatrizFluxoMensal,
  exportarFluxoCaixaCsv,
  exportarMatrizFluxoCsv,
  MESES_FLUXO_CAIXA,
  type LancamentoFluxo,
  type ModoFluxoCaixa,
  type SituacaoFluxoCaixa,
} from "@/lib/fluxo-de-caixa";
import { cn } from "@/lib/utils";
import { opcoesFormaPagamentoFiltro } from "@/lib/formas-pagamento";
import { prepararAbaPdf } from "@/lib/pdf-viewer";
import { abrirPdfBlobGerandoNoVisualizadorUnificado } from "@/lib/pdf-viewer-unificado";
import {
  dataImpressaoHoje,
  gerarRelatorioMovimentacaoPdf,
  labelPeriodoFluxoCaixa,
} from "@/lib/relatorio-movimentacao-pdf";

const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";

const inputDataFluxoClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white text-[12px] text-[#374151] shadow-none focus:border-[#4a90d9] focus:ring-0";

function money(value: number, locale: ReturnType<typeof useI18n>["locale"]) {
  return value.toLocaleString(localeMoeda(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function periodoMesAtualBr() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setDate(1);
  const fim = new Date(hoje);
  fim.setMonth(hoje.getMonth() + 1, 0);
  return { inicio: dateToBrShort(inicio), fim: dateToBrShort(fim) };
}

const periodoMesInicial = periodoMesAtualBr();

export function FluxoDeCaixaConteudo() {
  const { t, locale } = useI18n();
  const [lancamentos, setLancamentos] = useState<LancamentoFluxo[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<ModoFluxoCaixa>("diario");
  const [conta, setConta] = useState("Todos");
  const [tipo, setTipo] = useState("Todas");
  const [formaPagamento, setFormaPagamento] = useState("Forma Pagamento");
  const [periodo, setPeriodo] = useState("mes");
  const [dataInicio, setDataInicio] = useState(periodoMesInicial.inicio);
  const [dataFinal, setDataFinal] = useState(periodoMesInicial.fim);
  const [pagina, setPagina] = useState(1);
  const [anoMensal, setAnoMensal] = useState(new Date().getFullYear());
  const [situacao, setSituacao] = useState<SituacaoFluxoCaixa>(() => {
    const prefs = lerPreferenciasCookie();
    return prefs.fluxoSituacao === "previsto" ? "previsto" : "realizado";
  });
  const [pdfCarregando, setPdfCarregando] = useState(false);
  const [pdfProgresso, setPdfProgresso] = useState(0);
  const porPagina = 20;

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear();
    return [atual - 2, atual - 1, atual, atual + 1];
  }, []);

  const recarregarDados = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      /** Prefere endpoint agregado (issue 016); fallback para /api/financeiro. */
      const respRelatorio = await fetch(
        "/api/relatorios/fluxo-de-caixa",
        { cache: "no-store" }
      ).catch(() => null);

      let linhas: unknown[] = [];
      if (respRelatorio?.ok) {
        const dadosRel = (await respRelatorio.json()) as {
          linhas?: Array<Record<string, unknown>>;
        };
        linhas = Array.isArray(dadosRel.linhas) ? dadosRel.linhas : [];
      }

      if (linhas.length === 0) {
        const res = await fetch("/api/financeiro");
        const data = await res.json();
        linhas = Array.isArray(data.lancamentos) ? data.lancamentos : [];
      }

      setLancamentos(linhas as LancamentoFluxo[]);
      setContas(carregarContasBancarias().filter((c) => !c.excluida));
    } catch {
      setLancamentos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregarDados();
  }, [recarregarDados]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const atualizar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void recarregarDados(true);
      }, 320);
    };
    window.addEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
    };
  }, [recarregarDados]);

  function aplicarPeriodo(value: string) {
    setPeriodo(value);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (value === "todos" || value === "outro") {
      if (value === "todos") {
        setDataInicio("");
        setDataFinal("");
      }
      return;
    }
    const inicio = new Date(hoje);
    const fim = new Date(hoje);
    if (value === "semana") {
      const dia = hoje.getDay();
      inicio.setDate(hoje.getDate() - dia);
      fim.setDate(inicio.getDate() + 6);
    }
    if (value === "mes") {
      inicio.setDate(1);
      fim.setMonth(hoje.getMonth() + 1, 0);
    }
    if (value === "proximos30") {
      fim.setDate(hoje.getDate() + 30);
    }
    setDataInicio(dateToBrShort(inicio));
    setDataFinal(dateToBrShort(fim));
  }

  const formasOpcoes = useMemo(() => {
    const existentes = lancamentos.map((l) => l.formaPagamento || "");
    return opcoesFormaPagamentoFiltro(existentes);
  }, [lancamentos]);

  const opcoesConta = useMemo(() => {
    const nomes = contas.map((c) => ({ id: c.id, nome: c.nome }));
    return [{ id: "Todos", nome: "Todos" }, ...nomes];
  }, [contas]);

  const movimentacoes = useMemo(() => carregarMovimentacoesConta(), [lancamentos, contas]);

  const resultadoDiario = useMemo(() => {
    return calcularFluxoDeCaixa(
      lancamentos,
      movimentacoes,
      contas,
      {
        conta,
        tipo,
        formaPagamento,
        dataInicio,
        dataFim: dataFinal,
        modo: "diario",
      },
      periodo,
      situacao
    );
  }, [
    lancamentos,
    movimentacoes,
    contas,
    conta,
    tipo,
    formaPagamento,
    dataInicio,
    dataFinal,
    periodo,
    situacao,
  ]);

  const resultadoMensal = useMemo(() => {
    return calcularMatrizFluxoMensal(
      lancamentos,
      movimentacoes,
      contas,
      anoMensal,
      { conta, tipo, formaPagamento },
      situacao
    );
  }, [lancamentos, movimentacoes, contas, anoMensal, conta, tipo, formaPagamento, situacao]);

  useEffect(() => {
    salvarPreferenciasCookie({ fluxoSituacao: situacao, fluxoPeriodo: periodo });
  }, [situacao, periodo]);

  useEffect(() => {
    setPagina(1);
  }, [conta, tipo, formaPagamento, dataInicio, dataFinal, modo, periodo]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(resultadoDiario.linhas.length / porPagina)
  );
  const linhasPagina = resultadoDiario.linhas.slice(
    (pagina - 1) * porPagina,
    pagina * porPagina
  );

  async function imprimirRelatorio() {
    if (modo !== "diario") {
      alert(t("relatorio.alerta.pdfSomenteDiario"));
      return;
    }

    setPdfCarregando(true);
    setPdfProgresso(10);
    const janela = prepararAbaPdf();
    try {
      iniciarImpressaoRelatorio({ locale });
      const contaLabel =
        conta === "Todos"
          ? t("relatorio.opcao.todas")
          : traduzirContaFluxo(
              t,
              contas.find((c) => c.id === conta || c.nome === conta)?.nome ?? conta
            );

      setPdfProgresso(40);
      await abrirPdfBlobGerandoNoVisualizadorUnificado(
        () =>
          gerarRelatorioMovimentacaoPdf({
            linhas: resultadoDiario.linhas,
            contaLabel,
            periodoLabel: labelPeriodoFluxoCaixa(periodo, dataInicio, dataFinal, locale),
            dataImpressao: dataImpressaoHoje(),
            totalGeral: resultadoDiario.saldoFinal,
            locale,
          }),
        t("relatorio.fluxo.tituloPdf"),
        "relatorio-movimentacao.pdf",
        { janela, origem: t("relatorio.origemPdf") }
      );
      setPdfProgresso(100);
    } catch (err) {
      janela?.close();
      console.error("gerar PDF movimentação", err);
      alert(t("relatorio.alerta.pdfErro"));
    } finally {
      setPdfCarregando(false);
      setPdfProgresso(0);
    }
  }

  function exportarExcel() {
    const csv =
      modo === "mensal"
        ? exportarMatrizFluxoCsv(resultadoMensal.linhas, anoMensal)
        : exportarFluxoCaixaCsv(resultadoDiario.linhas);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      modo === "mensal"
        ? `fluxo-de-caixa-mensal-${anoMensal}.csv`
        : `fluxo-de-caixa-${dataInicio || "periodo"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const toggleModoBtn =
    "inline-flex h-[34px] items-center gap-2 px-4 text-[12px] font-medium transition-colors";

  return (
    <div className="pb-4 text-[11px] text-slate-600">
      <RelatorioCabecalho
        labelKey="nav.relatorio.fluxoCaixa"
        acoes={
          <div className="inline-flex overflow-hidden rounded-sm print:hidden">
            <button
              type="button"
              onClick={() => setModo("diario")}
              className={cn(
                toggleModoBtn,
                "border border-[#4a90d9]",
                modo === "diario"
                  ? "bg-[#4a90d9] text-white"
                  : "bg-white text-[#4a90d9]"
              )}
            >
              <List className="h-4 w-4" />
              {t("relatorio.modo.diario")}
            </button>
            <button
              type="button"
              onClick={() => setModo("mensal")}
              className={cn(
                toggleModoBtn,
                "border border-l-0 border-[#4a90d9]",
                modo === "mensal"
                  ? "bg-[#4a90d9] text-white"
                  : "bg-white text-[#4a90d9]"
              )}
            >
              <CalendarDays className="h-4 w-4" />
              {t("relatorio.modo.mensal")}
            </button>
          </div>
        }
      />

      {modo === "diario" && (
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-2xl font-semibold text-slate-800">
              {money(resultadoDiario.totalReceitas, locale)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{t("relatorio.kpi.totalReceitas")}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-2xl font-semibold text-slate-800">
              {money(resultadoDiario.totalDespesas, locale)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{t("relatorio.kpi.totalDespesas")}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-white">
            <Flag className="h-5 w-5" />
          </div>
        </div>
      </div>
      )}

      <div className="fluxo-caixa-painel overflow-hidden rounded-sm border border-[#e5e7eb] bg-white">
        {modo === "diario" ? (
        <div className="grid grid-cols-2 items-end gap-x-3 gap-y-3 border-b border-[#e5e7eb] px-4 py-4 sm:grid-cols-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] print:hidden">
          <div>
            <label className={labelClass}>{t("relatorio.filtro.conta")}</label>
            <select
              className={selectClass}
              value={conta}
              onChange={(e) => setConta(e.target.value)}
            >
              {opcoesConta.map((c) => (
                <option key={c.id} value={c.id === "Todos" ? "Todos" : c.nome}>
                  {c.id === "Todos"
                    ? t("relatorio.opcao.todos")
                    : traduzirContaFluxo(t, c.nome)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("relatorio.filtro.tipo")}</label>
            <select className={selectClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="Todas">{t("relatorio.opcao.todas")}</option>
              <option value="receita">{t("relatorio.opcao.receita")}</option>
              <option value="despesa">{t("relatorio.opcao.despesa")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("relatorio.filtro.formaPagamento")}</label>
            <select
              className={selectClass}
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              {formasOpcoes.map((f) => (
                <option key={f} value={f}>
                  {labelOpcaoFormaPagamentoFluxo(t, f)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("relatorio.filtro.periodo")}</label>
            <select
              className={selectClass}
              value={periodo}
              onChange={(e) => aplicarPeriodo(e.target.value)}
            >
              <option value="hoje">{t("relatorio.periodo.hoje")}</option>
              <option value="semana">{t("relatorio.periodo.semana")}</option>
              <option value="mes">{t("relatorio.periodo.mes")}</option>
              <option value="proximos30">{t("relatorio.periodo.proximos30")}</option>
              <option value="todos">{t("relatorio.periodo.todos")}</option>
              <option value="outro">{t("relatorio.periodo.outro")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("relatorio.filtro.situacao")}</label>
            <select
              className={selectClass}
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as SituacaoFluxoCaixa)}
            >
              <option value="previsto">{t("relatorio.opcao.previsto")}</option>
              <option value="realizado">{t("relatorio.opcao.realizado")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>&nbsp;</label>
            <CampoDataBr
              value={dataInicio}
              onChange={setDataInicio}
              iconPosition="left"
              className="space-y-0"
              inputClassName={inputDataFluxoClass}
              onValueChange={() => setPeriodo("outro")}
            />
          </div>
          <div>
            <label className={labelClass}>&nbsp;</label>
            <CampoDataBr
              value={dataFinal}
              onChange={setDataFinal}
              iconPosition="left"
              className="space-y-0"
              inputClassName={inputDataFluxoClass}
              onValueChange={() => setPeriodo("outro")}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              title={
                pdfCarregando
                  ? t("relatorio.gerandoPdf", { progresso: pdfProgresso })
                  : t("relatorio.imprimir")
              }
              disabled={pdfCarregando}
              onClick={() => void imprimirRelatorio()}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              className="flex h-[34px] items-center gap-1.5 rounded-sm border border-[#9ca3af] bg-[#9ca3af] px-3 text-[12px] font-medium text-white hover:bg-[#6b7280]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t("relatorio.excel")}
            </button>
          </div>
        </div>
        ) : (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e5e7eb] px-4 py-4 print:hidden">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-xl">
            <div>
              <label className={labelClass}>{t("relatorio.filtro.conta")}</label>
              <select
                className={selectClass}
                value={conta}
                onChange={(e) => setConta(e.target.value)}
              >
                {opcoesConta.map((c) => (
                  <option key={c.id} value={c.id === "Todos" ? "Todos" : c.nome}>
                    {c.id === "Todos"
                      ? t("relatorio.opcao.todos")
                      : traduzirContaFluxo(t, c.nome)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("relatorio.filtro.periodo")}</label>
              <select
                className={selectClass}
                value={String(anoMensal)}
                onChange={(e) => setAnoMensal(Number(e.target.value))}
              >
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("relatorio.filtro.situacao")}</label>
              <select
                className={selectClass}
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as SituacaoFluxoCaixa)}
              >
                <option value="previsto">{t("relatorio.opcao.previsto")}</option>
                <option value="realizado">{t("relatorio.opcao.realizado")}</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={exportarExcel}
            className="flex h-[34px] shrink-0 items-center gap-2 rounded-sm bg-[#9ca3af] px-4 text-[12px] font-medium text-white hover:bg-[#6b7280]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t("relatorio.excel")}
          </button>
        </div>
        )}

        {modo === "diario" ? (
        <div className="overflow-x-auto">
          <table className="fluxo-caixa-tabela w-full min-w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f3f4f6]">
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {t("relatorio.fluxo.colunaData")}
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {t("relatorio.fluxo.colunaDescricao")}
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {t("relatorio.fluxo.colunaForma")}
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {t("relatorio.fluxo.colunaConta")}
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {t("relatorio.fluxo.colunaValor")}
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {t("relatorio.fluxo.colunaSaldo")}
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr className="bg-white">
                  <td colSpan={6} className="px-4 py-12 text-center text-[#9ca3af]">
                    {t("relatorio.dre.carregandoTabela")}
                  </td>
                </tr>
              ) : linhasPagina.length === 0 ? (
                <tr className="bg-white">
                  <td colSpan={6} className="px-4 py-12 text-center text-[#9ca3af]">
                    {t("relatorio.fluxo.nenhumLancamento")}
                  </td>
                </tr>
              ) : (
                linhasPagina.map((linha, index) => (
                  <tr
                    key={linha.id}
                    className={cn(
                      "border-b border-[#f3f4f6]",
                      index % 2 === 0 ? "bg-white" : "bg-[#fafafa]"
                    )}
                  >
                    <td className="px-4 py-3 text-[#374151]">{linha.dataLabel}</td>
                    <td className="px-4 py-3 text-[#374151]">
                      {traduzirDescricaoFluxo(t, linha.descricao)}
                    </td>
                    <td className="px-4 py-3 text-[#374151]">
                      {traduzirFormaPagamentoFluxo(t, linha.forma)}
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{traduzirContaFluxo(t, linha.conta)}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-normal text-[#4a90d9]">
                      {linha.kind === "saldo_inicial" ? money(0, locale) : money(linha.valor, locale)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-normal text-[#4a90d9]">
                      {money(linha.saldo, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f3f4f6]">
                <th className="min-w-[120px] border-b border-[#e5e7eb] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]" />
                {MESES_FLUXO_CAIXA.map((mes, mesIndex) => (
                  <th
                    key={mes}
                    className="min-w-[72px] border-b border-[#e5e7eb] px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]"
                  >
                    {nomeMesLocale(locale, mesIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-[#9ca3af]">
                    {t("relatorio.dre.carregandoTabela")}
                  </td>
                </tr>
              ) : (
                resultadoMensal.linhas.map((linha, rowIndex) => (
                  <tr
                    key={linha.id}
                    className={cn(
                      "border-b border-[#f3f4f6]",
                      rowIndex % 2 === 0 ? "bg-white" : "bg-[#fafafa]"
                    )}
                  >
                    <td className="px-3 py-3 font-medium text-[#374151]">
                      {labelLinhaFluxoMensal(t, linha.id)}
                    </td>
                    {linha.valores.map((valor, mesIndex) => (
                      <td
                        key={`${linha.id}-${mesIndex}`}
                        className="px-2 py-3 text-right text-[#374151]"
                      >
                        {money(valor, locale)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {modo === "diario" && (
        <div className="flex items-center justify-center gap-3 py-4 print:hidden">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="text-[#9ca3af] hover:text-[#6b7280] disabled:opacity-30"
            aria-label={t("relatorio.comum.paginaAnterior")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4a90d9] text-[12px] font-semibold text-white"
          >
            {pagina}
          </button>
          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            className="text-[#9ca3af] hover:text-[#6b7280] disabled:opacity-30"
            aria-label={t("relatorio.comum.proximaPagina")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .fluxo-caixa-painel {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
