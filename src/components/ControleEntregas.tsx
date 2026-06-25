"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { BotoesImprimirExportarToolbar } from "@/components/BotoesImprimirExportarToolbar";
import { ControleProducaoToolbar } from "@/components/ControleProducaoToolbar";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { FormularioRotaEntregaModal } from "@/components/FormularioRotaEntregaModal";
import { RelatorioEntregasModal } from "@/components/relatorios/RelatorioEntregasModal";
import { Button, Modal } from "@/components/ui";
import { CampoDataBr } from "@/components/campo-data-br";
import {
  carregarEntregadores,
  carregarEntregas,
  contarPorSituacao,
  dataBrHoje,
  dataBrInicioMesAtual,
  ENTREGAS_EVENT,
  excluirEntrega,
  filtrarEntregas,
  formatarDataEntrega,
  formatarDataHoraEntrega,
  formatarMoedaEntrega,
  SITUACOES_ENTREGA,
  SITUACOES_ENTREGA_ATIVAS,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import {
  carregarHistoricoEntregas,
  ENTREGAS_HISTORICO_EVENT,
  labelSituacaoHistorico,
  sincronizarHistoricoEntregasCliente,
  type EntregaHistorico,
} from "@/lib/controle-entregas-historico";
import { sincronizarEntregasControleCliente } from "@/lib/controle-entregas-automatico";
import { ENTREGADORES_CADASTRO_EVENT } from "@/lib/entregadores-cadastro";
import { prepararAbaPdf } from "@/lib/pdf-viewer";
import {
  carregarTrabalhosParaRelatorioEntregas,
  exportarRelatorioEntregasCsv,
  filtroRelatorioFromTela,
  gerarLinhasRelatorioEntregas,
  imprimirRelatorioEntregas,
} from "@/lib/relatorio-entregas";

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
}: {
  valor: number;
  titulo: string;
  icone: React.ReactNode;
  ativo: boolean;
  onVer: () => void;
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
            Ver
          </button>
        </p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">{icone}</div>
    </div>
  );
}

export function ControleEntregas() {
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
  const [editando, setEditando] = useState<EntregaControle | null>(null);
  const [visualizando, setVisualizando] = useState<EntregaControle | null>(null);
  const [excluindo, setExcluindo] = useState<EntregaControle | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [exportandoRelatorio, setExportandoRelatorio] = useState(false);

  function recarregar() {
    setEntregas(carregarEntregas());
    setHistorico(carregarHistoricoEntregas());
    setEntregadores(carregarEntregadores());
  }

  useEffect(() => {
    recarregar();
    void Promise.all([
      sincronizarEntregasControleCliente(),
      sincronizarHistoricoEntregasCliente(),
    ]).then(() => recarregar());
    window.addEventListener(ENTREGAS_EVENT, recarregar);
    window.addEventListener(ENTREGAS_HISTORICO_EVENT, recarregar);
    window.addEventListener(ENTREGADORES_CADASTRO_EVENT, recarregar);
    return () => {
      window.removeEventListener(ENTREGAS_EVENT, recarregar);
      window.removeEventListener(ENTREGAS_HISTORICO_EVENT, recarregar);
      window.removeEventListener(ENTREGADORES_CADASTRO_EVENT, recarregar);
    };
  }, []);

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
    const janela = prepararAbaPdf();
    setExportandoRelatorio(true);
    try {
      const trabalhos = await carregarTrabalhosParaRelatorioEntregas();
      const linhas = gerarLinhasRelatorioEntregas(
        entregas,
        filtroRelatorioTela,
        trabalhos
      );
      await imprimirRelatorioEntregas(linhas, filtroRelatorioTela, janela);
    } catch {
      janela?.close();
      alert("Não foi possível gerar o PDF. Permita pop-ups para este site.");
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

  const barraEsquerda = (
    <>
      <button
        type="button"
        onClick={() => setRelatorioAberto(true)}
        className="rounded bg-[#3b82f6] px-4 py-1.5 text-[11px] font-medium text-white hover:bg-blue-600"
      >
        Relatórios
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
        Nova Entrega
      </button>
    </>
  );

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div className="text-sm text-slate-500">
        <span>Produção</span>
        <span className="mx-1">/</span>
        <span className="font-medium text-slate-700">Controle de Entregas</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <ControleProducaoToolbar viewAtiva="entregas" barraEsquerda={barraEsquerda} />

        <div className="mb-3 flex flex-wrap gap-3">
          <CardResumoEntrega
            valor={totais.pendente}
            titulo="Pendentes"
            ativo={filtroCard === "pendente"}
            onVer={() => alternarFiltroCard("pendente")}
            icone={<AlertTriangle className="h-6 w-6 text-red-500" />}
          />
          <CardResumoEntrega
            valor={totais.em_rota}
            titulo="Em Rota"
            ativo={filtroCard === "em_rota"}
            onVer={() => alternarFiltroCard("em_rota")}
            icone={<MapPin className="h-6 w-6 text-blue-500" />}
          />
          <CardResumoEntrega
            valor={totais.entregue}
            titulo="Entregues"
            ativo={historicoAberto}
            onVer={() => setHistoricoAberto(true)}
            icone={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          />
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[1.3fr_1.4fr_0.8fr_1fr]">
          <div>
            {labelFiltro("Selecione um Entregador")}
            <select
              value={entregador}
              onChange={(e) => setEntregador(e.target.value)}
              className={selectClassName()}
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
            {labelFiltro("Período")}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as "pedido" | "finalizado")}
                className={`${selectClassName()} max-w-[130px]`}
              >
                <option value="pedido">Data Pedido</option>
                <option value="finalizado">Data Finalizado</option>
              </select>
              <CampoDataBr
                value={dataInicio}
                onChange={setDataInicio}
                placeholder="dd/mm/aaaa"
                inputClassName="h-8 text-[11px]"
                className="min-w-[110px] flex-1 [&_label]:hidden"
              />
              <span className="text-slate-400">a</span>
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
            {labelFiltro("Situação")}
            <div className="relative">
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className={`${selectClassName()} pr-7`}
              >
                <option value="">Todos</option>
                {SITUACOES_ENTREGA_ATIVAS.map((key) => (
                  <option key={key} value={key}>
                    {SITUACOES_ENTREGA[key].label}
                  </option>
                ))}
              </select>
              {situacao ? (
                <button
                  type="button"
                  onClick={() => setSituacao("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Limpar situação"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div>
            {labelFiltro("Busca")}
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-300" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="destinatário, descrição e nome recebedor"
                  className="h-8 w-full rounded border border-[#d1d5db] bg-white pl-7 pr-2 text-[11px] text-slate-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setBusca("")}
                className="h-8 shrink-0 rounded bg-slate-500 px-3 text-[10px] font-semibold text-white hover:bg-slate-600"
              >
                Limpar
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
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-2 py-2 text-left">Data/Hora Pedido</th>
                <th className="px-2 py-2 text-left">Destinatário</th>
                <th className="px-2 py-2 text-left">Entregador</th>
                <th className="px-2 py-2 text-left">Descrição</th>
                <th className="px-2 py-2 text-left">Data Finalizado</th>
                <th className="px-2 py-2 text-left">Nome Recebedor</th>
                <th className="px-2 py-2 text-left">Situação</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-center">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {entregasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Nenhuma entrega encontrada para os filtros selecionados.
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
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${
                          SITUACOES_ENTREGA[entrega.situacao].badge
                        }`}
                      >
                        {SITUACOES_ENTREGA[entrega.situacao].label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{formatarMoedaEntrega(entrega.valor)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1 text-slate-500">
                        <button
                          type="button"
                          onClick={() => setVisualizando(entrega)}
                          className="rounded p-1 hover:bg-blue-50 hover:text-blue-600"
                          title="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEdicao(entrega)}
                          className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
                          title="Editar"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindo(entrega)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Excluir"
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

      <Modal
        open={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
        title="Histórico de entregas"
        size="lg"
      >
        <div className="space-y-3 text-[11px] text-slate-600">
          {historico.length === 0 ? (
            <p className="py-6 text-center text-slate-500">
              Nenhuma entrega concluída registrada no histórico.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 text-left">OS</th>
                    <th className="px-3 py-2 text-left">Destinatário</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-left">Entregue em</th>
                    <th className="px-3 py-2 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {historico.map((item) => (
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
                            Recebedor: {item.nomeRecebedor}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setHistoricoAberto(false)}>
            Fechar
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(visualizando)}
        onClose={() => setVisualizando(null)}
        title={visualizando ? `Entrega: ${visualizando.destinatario}` : "Entrega"}
        size="md"
      >
        {visualizando ? (
          <div className="space-y-3 text-[11px] text-slate-600">
            {visualizando.numeroOs ? (
              <p>
                <span className="font-semibold text-slate-700">OS:</span> {visualizando.numeroOs}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-slate-700">Data/Hora Pedido:</span>{" "}
              {formatarDataHoraEntrega(visualizando.dataPedido)}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Destinatário:</span>{" "}
              {visualizando.destinatario}
            </p>
            {visualizando.rua || visualizando.cep ? (
              <p>
                <span className="font-semibold text-slate-700">Endereço:</span>{" "}
                {[
                  visualizando.rua,
                  visualizando.numeroEndereco,
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
              <span className="font-semibold text-slate-700">Entregador:</span>{" "}
              {visualizando.entregador || "—"}
              {visualizando.tipoEntregador ? ` (${visualizando.tipoEntregador})` : ""}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Descrição:</span>{" "}
              {visualizando.descricao || "—"}
            </p>
            {visualizando.observacao ? (
              <p>
                <span className="font-semibold text-slate-700">Observação:</span>{" "}
                {visualizando.observacao}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-slate-700">Data Finalizado:</span>{" "}
              {formatarDataEntrega(visualizando.dataFinalizado)}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Nome Recebedor:</span>{" "}
              {visualizando.nomeRecebedor || "—"}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Situação:</span>{" "}
              {SITUACOES_ENTREGA[visualizando.situacao].label}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Valor:</span>{" "}
              {formatarMoedaEntrega(visualizando.valor)}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setVisualizando(null)}>
              Fechar
            </Button>
          </div>
        ) : null}
      </Modal>

      <ConfirmacaoExclusaoModal
        open={Boolean(excluindo)}
        titulo="Excluir Entrega"
        mensagem="Deseja realmente excluir esta entrega?"
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
