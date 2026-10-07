"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, DollarSign, Edit3, Eye, Wallet, X } from "lucide-react";
import { BotoesImprimirExportarToolbar } from "@/components/BotoesImprimirExportarToolbar";
import { ControleProducaoToolbar } from "@/components/ControleProducaoToolbar";
import { DetalheComissaoColaboradorModal } from "@/components/DetalheComissaoColaboradorModal";
import { useI18n } from "@/components/i18n-provider";
import { BreadcrumbProducao } from "@/components/producao/BreadcrumbProducao";
import { RelatorioComissaoColaboradoresModal } from "@/components/RelatorioComissaoColaboradoresModal";
import { CampoDataBr } from "@/components/ui";
import {
  exportarComissaoColaboradoresCsv,
  formatarMoedaComissao,
  montarLinhasComissaoColaboradores,
  type LinhaComissaoColaborador,
  type TrabalhoComissao,
} from "@/lib/comissoes-colaboradores";
import {
  lerComissoesEfetivadas,
  linhaComissaoEfetivada,
  type ComissoesEfetivadasStore,
} from "@/lib/comissoes-efetivadas";
import { aplicarEfetivacaoComissoes } from "@/lib/efetivar-comissao-colaborador";
import { gerarRelatorioComissaoColaboradoresModelo1Pdf } from "@/lib/pdf-relatorio-comissao-colaboradores-modelo1";
import { abrirPdfNoVisualizador, prepararAbaPdf } from "@/lib/pdf-viewer";
import { carregarColaboradoresListagem } from "@/lib/colaboradores-listagem";
import { carregarEtapasCadastro } from "@/lib/etapas-os";
import { intervaloMesVigente, parseBrDate } from "@/lib/datas-br";
import { labelStatusTrabalho, metaStatusTrabalho } from "@/lib/i18n/status-trabalho-i18n";
import { ARMAZENAMENTO_LAB_PRONTO_EVENT } from "@/lib/armazenamento-laboratorio";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { TRABALHOS_ATUALIZADOS_EVENT } from "@/lib/trabalhos-events";
import { cn, STATUS_TRABALHO } from "@/lib/utils";

const STORAGE_COMISSAO_ZERO = "labProteseControleComissaoZero";

function ToggleComissaoZero({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <span className="whitespace-nowrap text-[11px] text-slate-600">
        {t("producao.comum.comissaoZero")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-blue-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function CardResumo({
  titulo,
  valor,
  icone,
  iconeClassName = "bg-[#f97316]",
}: {
  titulo: string;
  valor: string;
  icone: React.ReactNode;
  iconeClassName?: string;
}) {
  return (
    <div className="flex min-w-[200px] flex-1 items-center justify-between rounded border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="text-[22px] font-normal leading-none text-[#374151]">{valor}</p>
        <p className="mt-2 text-[12px] text-[#6b7280]">{titulo}</p>
      </div>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${iconeClassName}`}
      >
        {icone}
      </div>
    </div>
  );
}

function ToggleValorServicoEtapa({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <span className="whitespace-nowrap text-[10px] text-slate-600">
        {t("producao.comum.valorServicoEtapa")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-slate-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function CardSelecionados({
  valor,
  mostrarValorServico,
  onToggleValorServico,
  onImprimir,
  imprimindo,
  temSelecionados,
}: {
  valor: string;
  mostrarValorServico: boolean;
  onToggleValorServico: (valor: boolean) => void;
  onImprimir: () => void;
  imprimindo: boolean;
  temSelecionados: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-w-[280px] flex-1 items-center justify-between rounded border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="text-[22px] font-normal leading-none text-[#374151]">{valor}</p>
        <p className="mt-2 text-[12px] text-[#6b7280]">{t("producao.comum.selecionados")}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onImprimir}
            disabled={!temSelecionados || imprimindo}
            className="rounded border border-[#3b82f6] bg-white px-3 py-1 text-[10px] font-medium text-[#3b82f6] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {imprimindo ? t("producao.comum.gerando") : t("producao.comum.imprimirSelecionados")}
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </div>
        <ToggleValorServicoEtapa checked={mostrarValorServico} onChange={onToggleValorServico} />
      </div>
    </div>
  );
}

function osBadge(numeroOs: number) {
  return (
    <span className="inline-flex min-w-9 items-center justify-center rounded bg-red-100 px-2 py-0.5 text-[12px] font-bold text-red-700">
      {numeroOs}
    </span>
  );
}

function labelFiltro(texto: string) {
  return <span className="mb-0.5 block text-[11px] text-slate-600">{texto}</span>;
}

function selectClassName() {
  return "h-8 w-full rounded border border-[#d1d5db] bg-white px-2 text-[11px] text-slate-700 focus:border-blue-500 focus:outline-none";
}

export function ControleComissoesColaboradores() {
  const { t } = useI18n();
  const [trabalhos, setTrabalhos] = useState<TrabalhoComissao[]>([]);
  const [colaborador, setColaborador] = useState("");
  const [periodo, setPeriodo] = useState("lancamento");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [situacao, setSituacao] = useState("");
  const [etapa, setEtapa] = useState("todos");
  const [comissaoZero, setComissaoZero] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mostrarValorServicoEtapa, setMostrarValorServicoEtapa] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [imprimindoSelecionados, setImprimindoSelecionados] = useState(false);
  const [exportandoTela, setExportandoTela] = useState(false);
  const [efetivadasStore, setEfetivadasStore] = useState<ComissoesEfetivadasStore>({
    linhas: {},
    despesas: {},
  });
  const [efetivando, setEfetivando] = useState(false);
  const [detalheColaborador, setDetalheColaborador] = useState<string | null>(null);

  useEffect(() => {
    try {
      setComissaoZero(readStorage<string | null>(STORAGE_COMISSAO_ZERO, null) === "1");
    } catch {
      setComissaoZero(false);
    }
    function hidratarEfetivadas() {
      try {
        setEfetivadasStore(lerComissoesEfetivadas());
      } catch {
        setEfetivadasStore({ linhas: {}, despesas: {} });
      }
    }
    hidratarEfetivadas();
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, hidratarEfetivadas);
    return () => window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, hidratarEfetivadas);
  }, []);

  async function load() {
    const res = await fetch("/api/trabalhos");
    const data = await res.json();
    setTrabalhos(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const atualizar = () => {
      void load();
    };
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
    return () => window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
  }, []);

  const colaboradoresCadastro = useMemo(() => carregarColaboradoresListagem(), [trabalhos]);
  const etapasCadastro = useMemo(() => carregarEtapasCadastro(), [trabalhos]);

  const linhasBase = useMemo(() => montarLinhasComissaoColaboradores(trabalhos), [trabalhos]);

  const nomesFiltroColaboradores = useMemo(() => {
    const nomes = new Set(colaboradoresCadastro.map((c) => c.nome));
    for (const linha of linhasBase) nomes.add(linha.colaborador);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradoresCadastro, linhasBase]);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (colaborador && linha.colaborador !== colaborador) return false;
      if (situacao && linha.situacaoKey !== situacao) return false;
      if (etapa !== "todos" && linha.etapa.trim().toLowerCase() !== etapa.toLowerCase()) {
        return false;
      }
      if (comissaoZero && linha.comissaoValor > 0) return false;

      if (dataInicio || dataFim) {
        const campoData =
          periodo === "entrega"
            ? linha.dataEntrega
            : linha.dataLancamento;
        if (campoData === "—") return false;
        const dataLinha = parseBrDate(campoData);
        if (!dataLinha) return false;
        if (dataInicio) {
          const ini = parseBrDate(dataInicio);
          if (ini && dataLinha < ini) return false;
        }
        if (dataFim) {
          const fim = parseBrDate(dataFim);
          if (fim) {
            const fimDia = new Date(fim);
            fimDia.setHours(23, 59, 59, 999);
            if (dataLinha > fimDia) return false;
          }
        }
      }

      return true;
    });
  }, [
    linhasBase,
    colaborador,
    situacao,
    etapa,
    comissaoZero,
    dataInicio,
    dataFim,
    periodo,
  ]);

  const totalComissoesMes = useMemo(() => {
    const { inicio, fim } = intervaloMesVigente();
    return linhasBase.reduce((soma, linha) => {
      if (colaborador && linha.colaborador !== colaborador) return soma;
      if (situacao && linha.situacaoKey !== situacao) return soma;
      if (etapa !== "todos" && linha.etapa.trim().toLowerCase() !== etapa.toLowerCase()) {
        return soma;
      }
      const campoData = periodo === "entrega" ? linha.dataEntrega : linha.dataLancamento;
      const dataLinha = parseBrDate(campoData);
      if (!dataLinha || dataLinha < inicio || dataLinha > fim) return soma;
      return soma + linha.comissaoValor;
    }, 0);
  }, [linhasBase, colaborador, situacao, etapa, periodo]);

  const totalComissoes = useMemo(
    () => linhasFiltradas.reduce((s, l) => s + l.comissaoValor, 0),
    [linhasFiltradas]
  );

  const totalAPagar = useMemo(
    () =>
      linhasFiltradas.reduce(
        (s, l) => (linhaComissaoEfetivada(efetivadasStore, l.id) ? s + l.comissaoValor : s),
        0
      ),
    [linhasFiltradas, efetivadasStore]
  );

  const idsEfetivados = useMemo(
    () => new Set(Object.keys(efetivadasStore.linhas)),
    [efetivadasStore]
  );

  const linhasDetalhe = useMemo(() => {
    if (!detalheColaborador) return [];
    return linhasFiltradas.filter((l) => l.colaborador === detalheColaborador);
  }, [detalheColaborador, linhasFiltradas]);

  const linhasSelecionadas = useMemo(
    () => linhasFiltradas.filter((l) => selecionados.has(l.id)),
    [linhasFiltradas, selecionados]
  );

  const totalSelecionados = useMemo(() => {
    return linhasSelecionadas.reduce(
      (s, l) => s + (mostrarValorServicoEtapa ? l.valorServico : l.comissaoValor),
      0
    );
  }, [linhasSelecionadas, mostrarValorServicoEtapa]);

  const todosSelecionados =
    linhasFiltradas.length > 0 && linhasFiltradas.every((l) => selecionados.has(l.id));

  async function sincronizarEfetivacao(
    linhasAlvo: LinhaComissaoColaborador[],
    efetivar: boolean
  ) {
    if (linhasAlvo.length === 0 || efetivando) return;
    setEfetivando(true);
    try {
      setEfetivadasStore(await aplicarEfetivacaoComissoes(linhasAlvo, efetivar));
    } catch (err) {
      console.error("efetivar comissao colaborador", err);
      const paga = err instanceof Error && err.name === "DespesaComissaoPagaError";
      alert(paga ? t("producao.comum.despesaPagaBloqueada") : t("producao.comum.erroEfetivar"));
      try {
        setEfetivadasStore(lerComissoesEfetivadas());
      } catch {
        /* ignore */
      }
    } finally {
      setEfetivando(false);
    }
  }

  function alternarEfetivacao(linha: LinhaComissaoColaborador) {
    const jaEfetivada = linhaComissaoEfetivada(efetivadasStore, linha.id);
    void sincronizarEfetivacao([linha], !jaEfetivada);
  }

  function alterarComissaoZero(valor: boolean) {
    setComissaoZero(valor);
    try {
      writeStorage(STORAGE_COMISSAO_ZERO, valor ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleLinha(id: string) {
    setSelecionados((atual) => {
      const next = new Set(atual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set());
      return;
    }
    setSelecionados(new Set(linhasFiltradas.map((l) => l.id)));
  }

  async function imprimirTela() {
    const janela = prepararAbaPdf();
    if (!janela) return;

    setExportandoTela(true);
    try {
      const blob = await gerarRelatorioComissaoColaboradoresModelo1Pdf(linhasFiltradas, {
        periodoCampo: periodo === "entrega" ? "data_entrega" : "data_lancamento",
      });
      abrirPdfNoVisualizador(
        blob,
        "comissao-colaboradores.pdf",
        t("producao.breadcrumb.comissao"),
        janela
      );
    } catch (err) {
      console.error("imprimir comissao colaboradores", err);
      janela.close();
      alert(t("producao.comum.pdfPopup"));
    } finally {
      setExportandoTela(false);
    }
  }

  function exportarExcelTela() {
    exportarComissaoColaboradoresCsv(linhasFiltradas);
  }

  async function imprimirSelecionados() {
    if (linhasSelecionadas.length === 0) return;

    const janela = prepararAbaPdf();
    if (!janela) return;

    setImprimindoSelecionados(true);
    try {
      const blob = await gerarRelatorioComissaoColaboradoresModelo1Pdf(linhasSelecionadas, {
        periodoCampo: periodo === "entrega" ? "data_entrega" : "data_lancamento",
      });
      abrirPdfNoVisualizador(
        blob,
        "relatorio-comissao-selecionados.pdf",
        t("producao.comum.imprimirSelecionados"),
        janela
      );
    } catch (err) {
      console.error("imprimir comissao selecionados", err);
      janela.close();
    } finally {
      setImprimindoSelecionados(false);
    }
  }

  const barraEsquerda = (
    <>
      <button
        type="button"
        onClick={() => setRelatorioAberto(true)}
        className="rounded bg-[#3b82f6] px-4 py-1.5 text-[11px] font-medium text-white hover:bg-blue-600"
      >
        {t("producao.comum.relatorios")}
      </button>
      <BotoesImprimirExportarToolbar
        onImprimir={() => void imprimirTela()}
        onExportarExcel={exportarExcelTela}
        processando={exportandoTela}
      />
      <ToggleComissaoZero checked={comissaoZero} onChange={alterarComissaoZero} />
    </>
  );

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <BreadcrumbProducao pagina="producao.breadcrumb.comissao" />

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <ControleProducaoToolbar viewAtiva="comissoes" barraEsquerda={barraEsquerda} />

        <div className="mb-3 flex flex-wrap gap-3">
          <CardResumo
            titulo={
              dataInicio || dataFim
                ? t("producao.comum.valorComissoes")
                : t("producao.comum.valorComissoesMes")
            }
            valor={formatarMoedaComissao(
              dataInicio || dataFim ? totalComissoes : totalComissoesMes
            )}
            icone={<DollarSign className="h-5 w-5" strokeWidth={2} />}
          />
          <CardResumo
            titulo={t("producao.comum.aPagar")}
            valor={formatarMoedaComissao(totalAPagar)}
            icone={<Wallet className="h-5 w-5" strokeWidth={2} />}
            iconeClassName="bg-emerald-500"
          />
          <CardSelecionados
            valor={formatarMoedaComissao(totalSelecionados)}
            mostrarValorServico={mostrarValorServicoEtapa}
            onToggleValorServico={setMostrarValorServicoEtapa}
            onImprimir={() => void imprimirSelecionados()}
            imprimindo={imprimindoSelecionados}
            temSelecionados={linhasSelecionadas.length > 0}
          />
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.85fr_0.85fr_1fr_1fr]">
          <div>
            {labelFiltro(t("producao.comum.colaboradores"))}
            <select
              value={colaborador}
              onChange={(e) => setColaborador(e.target.value)}
              className={selectClassName()}
            >
              <option value="">{t("common.todos")}</option>
              {nomesFiltroColaboradores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            {labelFiltro(t("producao.comum.periodo"))}
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className={selectClassName()}
            >
              <option value="lancamento">{t("producao.comum.dataLancamento")}</option>
              <option value="entrega">{t("producao.comum.dataEntrega")}</option>
            </select>
          </div>
          <CampoDataBr
            label={t("producao.comum.dataInicio")}
            value={dataInicio}
            onChange={setDataInicio}
            placeholder="dd/mm/aaaa"
            inputClassName="h-8 text-[11px]"
            className="[&_label]:text-[11px]"
          />
          <CampoDataBr
            label={t("producao.comum.dataFim")}
            value={dataFim}
            onChange={setDataFim}
            placeholder="dd/mm/aaaa"
            inputClassName="h-8 text-[11px]"
            className="[&_label]:text-[11px]"
          />
          <div>
            {labelFiltro(t("producao.controle.filtro.situacao"))}
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className={selectClassName()}
            >
              <option value="">{t("producao.comum.todas")}</option>
              {Object.keys(STATUS_TRABALHO).map((key) => (
                <option key={key} value={key}>
                  {labelStatusTrabalho(t, key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            {labelFiltro(t("producao.comum.etapa"))}
            <div className="relative">
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className={`${selectClassName()} pr-7`}
              >
                <option value="todos">{t("common.todos")}</option>
                {etapasCadastro.map((e) => (
                  <option key={e.id} value={e.nome}>
                    {e.nome}
                  </option>
                ))}
              </select>
              {etapa !== "todos" ? (
                <button
                  type="button"
                  onClick={() => setEtapa("todos")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={t("producao.comum.limparEtapa")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[1280px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 text-left">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      onChange={toggleTodos}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                      aria-label={t("producao.comum.selecionarTodos")}
                    />
                    <span>{t("common.todos")}</span>
                  </label>
                </th>
                <th className="px-2 py-2 text-left">{t("producao.controle.tabela.os")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.data")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.entregue")}</th>
                <th className="px-2 py-2 text-left">{t("producao.controle.tabela.qtd")}</th>
                <th className="px-2 py-2 text-left">{t("producao.controle.tabela.servico")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.descricao")}</th>
                <th className="px-2 py-2 text-left">{t("producao.controle.tabela.cliente")}</th>
                <th className="px-2 py-2 text-left">{t("producao.controle.tabela.paciente")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.colaborador")}</th>
                <th className="px-2 py-2 text-left">{t("producao.modulo.situacaoEtapa")}</th>
                <th className="px-2 py-2 text-left">{t("producao.controle.tabela.situacao")}</th>
                <th className="px-2 py-2 text-right">{t("producao.comum.comissao")}</th>
                <th className="px-2 py-2 text-center">{t("common.opcoes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {linhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-slate-500">
                    {t("producao.comum.semRegistroComissao")}
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map((linha) => (
                  <LinhaTabela
                    key={linha.id}
                    linha={linha}
                    selecionado={selecionados.has(linha.id)}
                    efetivada={idsEfetivados.has(linha.id)}
                    efetivando={efetivando}
                    onToggle={() => toggleLinha(linha.id)}
                    onSelecionarLinha={() => toggleLinha(linha.id)}
                    onDetalhes={() => setDetalheColaborador(linha.colaborador)}
                    onEfetivar={() => alternarEfetivacao(linha)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RelatorioComissaoColaboradoresModal
        open={relatorioAberto}
        onClose={() => setRelatorioAberto(false)}
        linhas={linhasBase}
        trabalhos={trabalhos.map((t) => ({
          id: t.id,
          numeroOs: t.numeroOs,
          grupoOsId: t.grupoOsId,
        }))}
        colaboradores={colaboradoresCadastro}
        etapas={etapasCadastro}
        idsSelecionados={selecionados}
      />

      <DetalheComissaoColaboradorModal
        open={Boolean(detalheColaborador)}
        colaborador={detalheColaborador || ""}
        linhas={linhasDetalhe}
        efetivadas={idsEfetivados}
        efetivando={efetivando}
        onClose={() => setDetalheColaborador(null)}
        onEfetivar={alternarEfetivacao}
        onEfetivarTodas={() =>
          void sincronizarEfetivacao(
            linhasDetalhe.filter((l) => !idsEfetivados.has(l.id) && l.comissaoValor > 0),
            true
          )
        }
      />
    </div>
  );
}

function LinhaTabela({
  linha,
  selecionado,
  efetivada,
  efetivando,
  onToggle,
  onSelecionarLinha,
  onDetalhes,
  onEfetivar,
}: {
  linha: LinhaComissaoColaborador;
  selecionado: boolean;
  efetivada: boolean;
  efetivando: boolean;
  onToggle: () => void;
  onSelecionarLinha: () => void;
  onDetalhes: () => void;
  onEfetivar: () => void;
}) {
  const { t } = useI18n();
  const statusMeta = metaStatusTrabalho(linha.situacaoKey);

  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors",
        selecionado ? "bg-[#e8f5e9] hover:bg-[#dff0e1]" : "hover:bg-slate-50"
      )}
      onClick={onSelecionarLinha}
    >
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selecionado}
          onChange={onToggle}
          className="h-3.5 w-3.5 rounded border-slate-300"
          aria-label={`${t("producao.comum.selecionarTodos")} OS ${linha.numeroOs}`}
        />
      </td>
      <td className="px-2 py-2">{osBadge(linha.numeroOs)}</td>
      <td className="whitespace-nowrap px-2 py-2">{linha.dataLancamento}</td>
      <td className="whitespace-nowrap px-2 py-2">{linha.dataEntrega}</td>
      <td className="px-2 py-2">{linha.qtd}</td>
      <td className="max-w-[140px] truncate px-2 py-2" title={linha.servico}>
        {linha.servico}
      </td>
      <td className="max-w-[120px] truncate px-2 py-2 text-slate-600" title={linha.descricao}>
        {linha.descricao}
      </td>
      <td className="max-w-[120px] truncate px-2 py-2">{linha.cliente}</td>
      <td className="max-w-[120px] truncate px-2 py-2">{linha.paciente}</td>
      <td className="max-w-[120px] truncate px-2 py-2" title={linha.colaborador}>
        {linha.colaborador}
      </td>
      <td className="px-2 py-2 text-slate-600">{linha.situacaoEtapa}</td>
      <td className="px-2 py-2">
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
            statusMeta?.color || "bg-slate-100 text-slate-700"
          }`}
        >
          {labelStatusTrabalho(t, linha.situacaoKey)}
        </span>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-slate-800">
        {formatarMoedaComissao(linha.comissaoValor)}
      </td>
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center gap-1 text-slate-500">
          <button
            type="button"
            onClick={onEfetivar}
            disabled={efetivando || (!efetivada && linha.comissaoValor <= 0)}
            title={
              efetivada
                ? t("producao.comum.desefetivarComissao")
                : t("producao.comum.efetivarComissao")
            }
            className={`rounded-full p-1 ${
              efetivada
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "text-emerald-600 hover:bg-emerald-50"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onDetalhes}
            title={t("producao.comum.detalhesComissao")}
            className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <Link
            href={`/app/producao/os?editar=${linha.trabalhoId}`}
            title={t("producao.comum.editarOs")}
            className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
          >
            <Edit3 className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
