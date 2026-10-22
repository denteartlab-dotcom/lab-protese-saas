"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  MapPin,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { usePageReady } from "@/hooks/use-page-ready";
import { useI18n } from "@/components/i18n-provider";
import { BreadcrumbProducao } from "@/components/producao/BreadcrumbProducao";
import { BotoesImprimirExportarToolbar } from "@/components/BotoesImprimirExportarToolbar";
import { ControleProducaoToolbar } from "@/components/ControleProducaoToolbar";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { FormularioRotaEntregaModal } from "@/components/FormularioRotaEntregaModal";
import { SituacaoEntregaModal } from "@/components/SituacaoEntregaModal";
import { RelatorioEntregasModal } from "@/components/relatorios/RelatorioEntregasModal";
import { Button, Modal } from "@/components/ui";
import { CampoDataBr } from "@/components/campo-data-br";
import {
  carregarEntregadores,
  carregarEntregas,
  contarPorSituacao,
  dataBrHoje,
  dataBrInicioMesAtual,
  atualizarEntregaPersistido,
  ENTREGAS_EVENT,
  excluirEntrega,
  filtrarEntregas,
  formatarDataEntrega,
  formatarDataHoraEntrega,
  formatarMoedaEntrega,
  ordensServicoDaEntrega,
  SITUACOES_ENTREGA,
  SITUACOES_ENTREGA_ATIVAS,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import {
  carregarHistoricoEntregas,
  filtrarHistoricoEntregas,
  ENTREGAS_HISTORICO_EVENT,
  excluirHistoricoEntregaPersistido,
  imprimirHistoricoEntregas,
  labelSituacaoHistorico,
  sincronizarHistoricoEntregasCliente,
  type EntregaHistorico,
} from "@/lib/controle-entregas-historico-cliente";
import { sincronizarEntregasControleCliente } from "@/lib/controle-entregas-automatico-cliente";
import { ENTREGADORES_CADASTRO_EVENT } from "@/lib/entregadores-cadastro";
import {
  carregarTrabalhosParaRelatorioEntregas,
  exportarRelatorioEntregasCsv,
  filtroRelatorioFromTela,
  gerarLinhasRelatorioEntregas,
  imprimirRelatorioEntregas,
} from "@/lib/relatorio-entregas";
import { labelSituacaoEntrega } from "@/lib/i18n/entrega-i18n";
import { imprimirEtiquetaEntrega } from "@/lib/etiqueta-envio-entrega";

function labelFiltro(texto: string) {
  return <span className="mb-0.5 block text-[11px] text-slate-600">{texto}</span>;
}

function selectClassName() {
  return "h-8 w-full rounded border border-[#d1d5db] bg-white px-2 text-[11px] text-slate-700 focus:border-blue-500 focus:outline-none";
}

function CardResumoEntrega({
  valor,
  titulo,
  icone,
  ativo,
  onVer,
  labelVer,
}: {
  valor: number;
  titulo: string;
  icone: React.ReactNode;
  ativo: boolean;
  onVer: () => void;
  labelVer: string;
}) {
  return (
    <div
      className={`flex min-w-[180px] flex-1 items-center justify-between rounded border bg-white px-4 py-3 shadow-sm ${
        ativo ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div>
        <p className="text-[22px] font-normal leading-none text-slate-700">{valor}</p>
        <p className="mt-2 text-[12px] text-slate-500">
          {titulo}{" "}
          <button
            type="button"
            onClick={onVer}
            className="ml-1 rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-blue-600"
          >
            {labelVer}
          </button>
        </p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">{icone}</div>
    </div>
  );
}

export function ControleEntregas() {
  const { t } = useI18n();
  const [entregas, setEntregas] = useState<EntregaControle[]>([]);
  const [historico, setHistorico] = useState<EntregaHistorico[]>([]);
  const [entregadores, setEntregadores] = useState<string[]>([]);
  const [entregador, setEntregador] = useState("");
  const [periodo, setPeriodo] = useState<"pedido" | "finalizado">("pedido");
  const [dataInicio, setDataInicio] = useState(dataBrInicioMesAtual);
  const [dataFim, setDataFim] = useState(dataBrHoje);
  const [situacao, setSituacao] = useState("");
  const [filtroCard, setFiltroCard] = useState<"pendente" | "em_rota" | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoCliente, setHistoricoCliente] = useState("");
  const [historicoDataInicio, setHistoricoDataInicio] = useState("");
  const [historicoDataFim, setHistoricoDataFim] = useState("");
  const [historicoExcluindo, setHistoricoExcluindo] = useState<EntregaHistorico | null>(null);
  const [imprimindoHistorico, setImprimindoHistorico] = useState(false);
  const [editando, setEditando] = useState<EntregaControle | null>(null);
  const [visualizando, setVisualizando] = useState<EntregaControle | null>(null);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [excluindo, setExcluindo] = useState<EntregaControle | null>(null);
  const [situacaoEditando, setSituacaoEditando] = useState<EntregaControle | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [exportandoRelatorio, setExportandoRelatorio] = useState(false);

  function recarregar() {
    setEntregas(carregarEntregas());
    setHistorico(carregarHistoricoEntregas());
    setEntregadores(carregarEntregadores());
  }

  const paginaPronta = usePageReady(async () => {
    recarregar();
    await Promise.all([
      sincronizarEntregasControleCliente(),
      sincronizarHistoricoEntregasCliente(),
    ]);
    recarregar();
  });

  useEffect(() => {
    if (!paginaPronta) return;

    window.addEventListener(ENTREGAS_EVENT, recarregar);
    window.addEventListener(ENTREGAS_HISTORICO_EVENT, recarregar);
    window.addEventListener(ENTREGADORES_CADASTRO_EVENT, recarregar);
    return () => {
      window.removeEventListener(ENTREGAS_EVENT, recarregar);
      window.removeEventListener(ENTREGAS_HISTORICO_EVENT, recarregar);
      window.removeEventListener(ENTREGADORES_CADASTRO_EVENT, recarregar);
    };
  }, [paginaPronta]);

  const entregasFiltradas = useMemo(
    () =>
      filtrarEntregas(entregas, {
        entregador,
        situacaoCard: filtroCard,
        situacao,
        periodo,
        dataInicio,
        dataFim,
        busca,
      }),
    [entregas, entregador, filtroCard, situacao, periodo, dataInicio, dataFim, busca]
  );

  const totais = useMemo(() => contarPorSituacao(entregas, historico.length), [entregas, historico]);

  const clientesHistorico = useMemo(
    () =>
      Array.from(new Set(historico.map((item) => item.destinatario.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [historico]
  );

  const historicoFiltrado = useMemo(
    () =>
      filtrarHistoricoEntregas(historico, {
        cliente: historicoCliente,
        dataInicio: historicoDataInicio,
        dataFim: historicoDataFim,
      }),
    [historico, historicoCliente, historicoDataInicio, historicoDataFim]
  );

  const filtroRelatorioTela = useMemo(
    () =>
      filtroRelatorioFromTela({
        entregador,
        situacao,
        filtroCard,
        periodo,
        dataInicio,
        dataFim,
        busca,
      }),
    [entregador, situacao, filtroCard, periodo, dataInicio, dataFim, busca]
  );

  async function exportarRelatorioTela() {
    setExportandoRelatorio(true);
    try {
      const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
      const linhas = gerarLinhasRelatorioEntregas(
        entregas,
        filtroRelatorioTela,
        trabalhos
      );
      exportarRelatorioEntregasCsv(linhas, filtroRelatorioTela.modelo);
    } finally {
      setExportandoRelatorio(false);
    }
  }

  async function imprimirRelatorioTela() {
    setExportandoRelatorio(true);
    try {
      const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
      const linhas = gerarLinhasRelatorioEntregas(
        entregas,
        filtroRelatorioTela,
        trabalhos
      );
      await imprimirRelatorioEntregas(linhas, filtroRelatorioTela);
    } catch (err) {
      console.error("[controle-entregas] imprimir relatório", err);
      alert(
        err instanceof Error && err.message
          ? err.message
          : t("producao.comum.relatorioErro")
      );
    } finally {
      setExportandoRelatorio(false);
    }
  }

  const todosSelecionados =
    entregasFiltradas.length > 0 && entregasFiltradas.every((item) => selecionados.has(item.id));

  function alternarFiltroCard(filtro: "pendente" | "em_rota") {
    setFiltroCard((atual) => (atual === filtro ? "todos" : filtro));
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
    setSelecionados(new Set(entregasFiltradas.map((item) => item.id)));
  }

  function abrirNovaEntrega() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(entrega: EntregaControle) {
    setEditando(entrega);
    setModalAberto(true);
  }

  function fecharModalRota() {
    setModalAberto(false);
    setEditando(null);
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    excluirEntrega(excluindo.id);
    setExcluindo(null);
    recarregar();
  }

  async function confirmarExclusaoHistorico() {
    const item = historicoExcluindo;
    if (!item) return;
    setHistoricoExcluindo(null);
    try {
      await excluirHistoricoEntregaPersistido(item.id);
      recarregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("producao.comum.erroExcluirHistorico"));
      recarregar();
    }
  }

  async function confirmarEnvioEntrega() {
    if (!visualizando || visualizando.situacao !== "pendente") return;
    setConfirmandoEnvio(true);
    try {
      await atualizarEntregaPersistido(visualizando.id, { situacao: "em_rota" });
      setVisualizando({ ...visualizando, situacao: "em_rota" });
      recarregar();
    } catch (err) {
      alert(
        err instanceof Error && err.message
          ? err.message
          : t("producao.entregas.visualizar.erroConfirmar")
      );
    } finally {
      setConfirmandoEnvio(false);
    }
  }

  function imprimirHistoricoModal() {
    setImprimindoHistorico(true);
    void imprimirHistoricoEntregas(historicoFiltrado)
      .catch((err) => {
        console.error("[controle-entregas] imprimir histórico", err);
        alert(
          err instanceof Error && err.message
            ? err.message
            : t("producao.comum.erroImprimirHistorico")
        );
      })
      .finally(() => setImprimindoHistorico(false));
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
        onImprimir={() => void imprimirRelatorioTela()}
        onExportarExcel={() => void exportarRelatorioTela()}
        processando={exportandoRelatorio}
      />
      <button
        type="button"
        onClick={abrirNovaEntrega}
        className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("producao.comum.novaEntrega")}
      </button>
    </>
  );

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <BreadcrumbProducao pagina="producao.breadcrumb.entregas" />

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <ControleProducaoToolbar viewAtiva="entregas" barraEsquerda={barraEsquerda} />

        <div className="mb-3 flex flex-wrap gap-3">
          <CardResumoEntrega
            valor={totais.pendente}
            titulo={t("producao.comum.pendentes")}
            labelVer={t("producao.comum.ver")}
            ativo={filtroCard === "pendente"}
            onVer={() => alternarFiltroCard("pendente")}
            icone={<AlertTriangle className="h-6 w-6 text-red-500" />}
          />
          <CardResumoEntrega
            valor={totais.em_rota}
            titulo={t("producao.comum.emRota")}
            labelVer={t("producao.comum.ver")}
            ativo={filtroCard === "em_rota"}
            onVer={() => alternarFiltroCard("em_rota")}
            icone={<MapPin className="h-6 w-6 text-blue-500" />}
          />
          <CardResumoEntrega
            valor={totais.entregue}
            titulo={t("producao.comum.entregues")}
            labelVer={t("producao.comum.ver")}
            ativo={historicoAberto}
            onVer={() => {
              setHistoricoCliente("");
              setHistoricoDataInicio("");
              setHistoricoDataFim("");
              setHistoricoAberto(true);
            }}
            icone={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          />
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[1.3fr_1.4fr_0.8fr_1fr]">
          <div>
            {labelFiltro(t("producao.comum.selecioneEntregador"))}
            <select
              value={entregador}
              onChange={(e) => setEntregador(e.target.value)}
              className={selectClassName()}
            >
              <option value="">{t("common.todos")}</option>
              {entregadores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            {labelFiltro(t("producao.comum.periodo"))}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as "pedido" | "finalizado")}
                className={`${selectClassName()} max-w-[130px]`}
              >
                <option value="pedido">{t("producao.comum.dataPedido")}</option>
                <option value="finalizado">{t("producao.comum.dataFinalizado")}</option>
              </select>
              <CampoDataBr
                value={dataInicio}
                onChange={setDataInicio}
                placeholder="dd/mm/aaaa"
                inputClassName="h-8 text-[11px]"
                className="min-w-[110px] flex-1 [&_label]:hidden"
              />
              <span className="text-slate-400">{t("producao.comum.ate")}</span>
              <CampoDataBr
                value={dataFim}
                onChange={setDataFim}
                placeholder="dd/mm/aaaa"
                inputClassName="h-8 text-[11px]"
                className="min-w-[110px] flex-1 [&_label]:hidden"
              />
            </div>
          </div>

          <div>
            {labelFiltro(t("producao.comum.situacao"))}
            <div className="relative">
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className={`${selectClassName()} pr-7`}
              >
                <option value="">{t("common.todos")}</option>
                {SITUACOES_ENTREGA_ATIVAS.map((key) => (
                  <option key={key} value={key}>
                    {labelSituacaoEntrega(t, key)}
                  </option>
                ))}
              </select>
              {situacao ? (
                <button
                  type="button"
                  onClick={() => setSituacao("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={t("producao.comum.limparSituacao")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div>
            {labelFiltro(t("producao.comum.busca"))}
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-300" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={t("producao.comum.buscaEntregaPlaceholder")}
                  className="h-8 w-full rounded border border-[#d1d5db] bg-white pl-7 pr-2 text-[11px] text-slate-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setBusca("")}
                className="h-8 shrink-0 rounded bg-slate-500 px-3 text-[10px] font-semibold text-white hover:bg-slate-600"
              >
                {t("common.limpar")}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[1180px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleTodos}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    aria-label={t("producao.comum.selecionarTodos")}
                  />
                </th>
                <th className="px-2 py-2 text-left">{t("producao.comum.dataHoraPedido")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.destinatario")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.entregador")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.descricao")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.dataFinalizado")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.nomeRecebedor")}</th>
                <th className="px-2 py-2 text-left">{t("producao.comum.situacao")}</th>
                <th className="px-2 py-2 text-right">{t("producao.comum.valor")}</th>
                <th className="px-2 py-2 text-center">{t("common.opcoes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {entregasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    {t("producao.comum.semEntregaFiltro")}
                  </td>
                </tr>
              ) : (
                entregasFiltradas.map((entrega) => (
                  <tr key={entrega.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selecionados.has(entrega.id)}
                        onChange={() => toggleLinha(entrega.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatarDataHoraEntrega(entrega.dataPedido)}
                    </td>
                    <td className="px-2 py-2">{entrega.destinatario}</td>
                    <td className="px-2 py-2">{entrega.entregador || "—"}</td>
                    <td className="px-2 py-2">{entrega.descricao || "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatarDataEntrega(entrega.dataFinalizado)}
                    </td>
                    <td className="px-2 py-2">{entrega.nomeRecebedor || "—"}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setSituacaoEditando(entrega)}
                        className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-90 hover:ring-2 hover:ring-blue-200 ${
                          SITUACOES_ENTREGA[entrega.situacao].badge
                        }`}
                        title={t("producao.entregas.modalSituacao.alterar")}
                      >
                        {labelSituacaoEntrega(t, entrega.situacao)}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">{formatarMoedaEntrega(entrega.valor)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1 text-slate-500">
                        <button
                          type="button"
                          onClick={() => setVisualizando(entrega)}
                          className="rounded p-1 hover:bg-blue-50 hover:text-blue-600"
                          title={t("producao.comum.visualizar")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const abriu = imprimirEtiquetaEntrega(entrega, {
                              titulo: t("producao.entregas.etiqueta.titulo"),
                              destinatario: t("producao.entregas.etiqueta.destinatario"),
                              remetente: t("producao.entregas.etiqueta.remetente"),
                              os: t("producao.controle.tabela.os"),
                              cep: t("producao.entregas.etiqueta.cep"),
                              remetenteSemCadastro: t("producao.entregas.etiqueta.remetenteSemCadastro"),
                              imprimir: t("producao.comum.imprimir"),
                              fechar: t("common.fechar"),
                            });
                            if (!abriu) alert(t("print.comum.erroAbrirPopups"));
                          }}
                          className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
                          title={t("producao.entregas.etiqueta.imprimir")}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEdicao(entrega)}
                          className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
                          title={t("common.editar")}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindo(entrega)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title={t("common.excluir")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FormularioRotaEntregaModal
        open={modalAberto}
        editando={editando}
        onClose={fecharModalRota}
        onSalvo={recarregar}
      />

      <SituacaoEntregaModal
        open={Boolean(situacaoEditando)}
        entrega={situacaoEditando}
        onClose={() => setSituacaoEditando(null)}
        onSalvo={recarregar}
      />

      <Modal
        open={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
        title={t("producao.comum.historicoEntregas")}
        size="lg"
      >
        <div className="space-y-3 text-[11px] text-slate-600">
          <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(240px,1.4fr)_auto] md:items-end">
            <div>
              {labelFiltro(t("producao.entregas.historico.cliente"))}
              <select
                value={historicoCliente}
                onChange={(e) => setHistoricoCliente(e.target.value)}
                className={selectClassName()}
              >
                <option value="">{t("producao.entregas.historico.mostrarTodos")}</option>
                {clientesHistorico.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {labelFiltro(t("producao.entregas.historico.periodo"))}
              <div className="flex flex-wrap items-center gap-1.5">
                <CampoDataBr
                  value={historicoDataInicio}
                  onChange={setHistoricoDataInicio}
                  placeholder="dd/mm/aaaa"
                  inputClassName="h-8 text-[11px]"
                  className="min-w-[110px] flex-1 [&_label]:hidden"
                  calendarZIndex={10050}
                />
                <span className="text-slate-400">{t("producao.comum.ate")}</span>
                <CampoDataBr
                  value={historicoDataFim}
                  onChange={setHistoricoDataFim}
                  placeholder="dd/mm/aaaa"
                  inputClassName="h-8 text-[11px]"
                  className="min-w-[110px] flex-1 [&_label]:hidden"
                  calendarZIndex={10050}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={imprimirHistoricoModal}
              disabled={imprimindoHistorico || historicoFiltrado.length === 0}
              className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              {t("producao.comum.imprimir")}
            </button>
          </div>
          {historico.length === 0 ? (
            <p className="py-6 text-center text-slate-500">
              {t("producao.comum.semHistoricoEntregas")}
            </p>
          ) : historicoFiltrado.length === 0 ? (
            <p className="py-6 text-center text-slate-500">
              {t("producao.entregas.historico.vazioFiltro")}
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 text-left">{t("producao.controle.tabela.os")}</th>
                    <th className="px-3 py-2 text-left">{t("producao.comum.destinatario")}</th>
                    <th className="px-3 py-2 text-left">{t("producao.comum.descricao")}</th>
                    <th className="px-3 py-2 text-left">{t("producao.comum.entregueEm")}</th>
                    <th className="px-3 py-2 text-left">{t("producao.comum.situacao")}</th>
                    <th className="px-3 py-2 text-center">{t("common.opcoes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {historicoFiltrado.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {item.numeroOs || "—"}
                      </td>
                      <td className="px-3 py-2">{item.destinatario}</td>
                      <td className="px-3 py-2">{item.descricao || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatarDataHoraEntrega(item.dataFinalizado)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${
                            item.situacao === "recebido"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {labelSituacaoHistorico(item.situacao)}
                        </span>
                        {item.nomeRecebedor ? (
                          <p className="mt-1 text-[10px] text-slate-500">
                            {t("producao.comum.recebedor")}: {item.nomeRecebedor}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setHistoricoExcluindo(item)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title={t("producao.comum.excluirHistorico")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setHistoricoAberto(false)}>
            {t("common.fechar")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(visualizando)}
        onClose={() => setVisualizando(null)}
        title={
          visualizando
            ? `${t("producao.comum.entrega")}: ${visualizando.destinatario}`
            : t("producao.comum.entrega")
        }
        size="lg"
      >
        {visualizando ? (
          <div className="space-y-3 text-[11px] text-slate-600">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-700">
                  {t("producao.entregas.visualizar.osTitulo")}
                </p>
                {visualizando.situacao === "pendente" ? (
                  <button
                    type="button"
                    onClick={() => void confirmarEnvioEntrega()}
                    disabled={confirmandoEnvio}
                    className="rounded bg-[#4a90d9] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
                  >
                    {t("producao.entregas.visualizar.confirmarEnvio")}
                  </button>
                ) : visualizando.situacao === "em_rota" ? (
                  <p className="text-[11px] font-medium text-blue-700">
                    {t("producao.entregas.visualizar.jaEmRota")}
                  </p>
                ) : null}
              </div>
              {ordensServicoDaEntrega(visualizando).length === 0 ? (
                <p className="text-slate-500">{t("producao.entregas.visualizar.semOs")}</p>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2 text-left">{t("producao.controle.tabela.os")}</th>
                        <th className="px-2 py-2 text-left">{t("producao.entregas.rota.paciente")}</th>
                        <th className="px-2 py-2 text-left">{t("producao.entregas.rota.servico")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {ordensServicoDaEntrega(visualizando).map((ordem) => (
                        <tr key={ordem.numeroOs}>
                          <td className="px-2 py-2 font-semibold text-slate-700">{ordem.numeroOs}</td>
                          <td className="px-2 py-2">{ordem.paciente || "—"}</td>
                          <td className="px-2 py-2">{ordem.descricao || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.dataHoraPedido")}:</span>{" "}
              {formatarDataHoraEntrega(visualizando.dataPedido)}
            </p>
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.destinatario")}:</span>{" "}
              {visualizando.destinatario}
            </p>
            {visualizando.rua || visualizando.cep ? (
              <p>
                <span className="font-semibold text-slate-700">{t("producao.comum.endereco")}:</span>{" "}
                {[
                  visualizando.rua,
                  visualizando.numeroEndereco,
                  visualizando.complemento,
                  visualizando.bairro,
                  visualizando.cidade,
                  visualizando.uf,
                  visualizando.cep,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.entregador")}:</span>{" "}
              {visualizando.entregador || "—"}
              {visualizando.tipoEntregador ? ` (${visualizando.tipoEntregador})` : ""}
            </p>
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.descricao")}:</span>{" "}
              {visualizando.descricao || "—"}
            </p>
            {visualizando.observacao ? (
              <p>
                <span className="font-semibold text-slate-700">{t("producao.os.campo.observacao")}:</span>{" "}
                {visualizando.observacao}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.dataFinalizado")}:</span>{" "}
              {formatarDataEntrega(visualizando.dataFinalizado)}
            </p>
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.nomeRecebedor")}:</span>{" "}
              {visualizando.nomeRecebedor || "—"}
            </p>
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.situacao")}:</span>{" "}
              {labelSituacaoEntrega(t, visualizando.situacao)}
            </p>
            <p>
              <span className="font-semibold text-slate-700">{t("producao.comum.valor")}:</span>{" "}
              {formatarMoedaEntrega(visualizando.valor)}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setVisualizando(null)}>
              {t("common.fechar")}
            </Button>
          </div>
        ) : null}
      </Modal>

      <ConfirmacaoExclusaoModal
        open={Boolean(historicoExcluindo)}
        titulo={t("producao.comum.excluirHistorico")}
        mensagem={t("producao.comum.confirmarExcluirHistorico")}
        detalhe={
          historicoExcluindo
            ? historicoExcluindo.numeroOs
              ? `OS ${historicoExcluindo.numeroOs} — ${historicoExcluindo.destinatario}`
              : historicoExcluindo.destinatario
            : undefined
        }
        onClose={() => setHistoricoExcluindo(null)}
        onConfirm={() => void confirmarExclusaoHistorico()}
      />

      <ConfirmacaoExclusaoModal
        open={Boolean(excluindo)}
        titulo={t("producao.comum.excluirEntrega")}
        mensagem={t("producao.comum.confirmarExcluirEntrega")}
        detalhe={excluindo?.destinatario}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExclusao}
      />

      <RelatorioEntregasModal
        open={relatorioAberto}
        onClose={() => setRelatorioAberto(false)}
        entregas={entregas}
        entregadores={entregadores}
        filtrosIniciais={filtroRelatorioTela}
      />
    </div>
  );
}
