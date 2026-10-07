"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  DollarSign,
  Eye,
  EyeOff,
  RefreshCw,
  ScanBarcode,
  User,
  X,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LeitorCodigoBarrasModal } from "@/components/LeitorCodigoBarrasModal";
import { InputLeitorCodigoOs } from "@/components/InputLeitorCodigoOs";
import { CampoDataBr, Select } from "@/components/ui";
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";
import type { MessageKey } from "@/lib/i18n";
import {
  labelStatusTrabalho,
  metaStatusTrabalho,
  opcoesStatusTrabalho,
} from "@/lib/i18n/status-trabalho-i18n";
import { carregarColaboradoresListagem } from "@/lib/colaboradores-listagem";
import {
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
import { dateToBrShort, intervaloMesVigenteBr, parseBrDate } from "@/lib/datas-br";
import type { EtapaOsLinha } from "@/lib/etapas-os";
import {
  complementosDaOs,
  formatDateModulo,
  itensDaOsModulo,
  itensDoGrupoOs,
  valorLinhaInstrucao,
  type ItemModuloOs,
  type TrabalhoModuloOs,
} from "@/lib/modulo-producao-os";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { TRABALHOS_ATUALIZADOS_EVENT } from "@/lib/trabalhos-events";
import { ARMAZENAMENTO_LAB_PRONTO_EVENT } from "@/lib/armazenamento-laboratorio";
import { cn } from "@/lib/utils";
import {
  carregarConfiguracoesGerais,
  CONFIG_GERAIS_ATUALIZADA_EVENT,
} from "@/lib/configuracoes-gerais";
import {
  etapasConcluidasModulo,
  indiceEtapaAtualDeConcluidas,
  podeAlternarEtapaConcluida,
  salvarEtapasConcluidasModulo,
} from "@/lib/modulo-producao-etapas";
import { useSessaoInatividade } from "@/hooks/use-sessao-inatividade";
import {
  aplicarControleEntregaAposMudancaStatus,
} from "@/lib/controle-entregas-automatico-cliente";
import { limparUltimaAtividadeSessao } from "@/lib/sessao-inatividade";

type AbaModulo = "etapas" | "anotacoes" | "imagens" | "detalhes";

const ABAS_MODULO: { id: AbaModulo; labelKey: MessageKey }[] = [
  { id: "etapas", labelKey: "producao.modulo.aba.etapas" },
  { id: "anotacoes", labelKey: "producao.modulo.aba.anotacoes" },
  { id: "imagens", labelKey: "producao.modulo.aba.imagens" },
  { id: "detalhes", labelKey: "producao.modulo.aba.detalhes" },
];

type Props = {
  userName: string;
  userRole: string;
};

export function ModuloProducaoColaborador({ userName: _userName, userRole: _userRole }: Props) {
  const { t } = useI18n();
  const opcoesStatus = useMemo(() => opcoesStatusTrabalho(t), [t]);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [resultadosOs, setResultadosOs] = useState<TrabalhoModuloOs[]>([]);
  const [osSelecionada, setOsSelecionada] = useState<TrabalhoModuloOs | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<AbaModulo>("etapas");
  const [leitorAberto, setLeitorAberto] = useState(false);
  const [buscaPacienteAberta, setBuscaPacienteAberta] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [grupoOs, setGrupoOs] = useState<TrabalhoModuloOs[]>([]);
  const [etapasOs, setEtapasOs] = useState<EtapaOsLinha[]>([]);
  const [etapasOk, setEtapasOk] = useState<Set<number>>(new Set());
  const [anotacoes, setAnotacoes] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);
  const [comissaoVisivel, setComissaoVisivel] = useState(true);
  const [avisoEtapa, setAvisoEtapa] = useState("");
  const [exigeAnteriorFinalizada, setExigeAnteriorFinalizada] = useState(
    () => carregarConfiguracoesGerais().producaoEtapaExigeAnteriorFinalizada
  );
  const mesVigente = useMemo(() => intervaloMesVigenteBr(), []);
  const [trabalhos, setTrabalhos] = useState<TrabalhoComissao[]>([]);
  const [colaboradorFiltro, setColaboradorFiltro] = useState("");
  const [periodoFiltro, setPeriodoFiltro] = useState("mes");
  const [dataInicio, setDataInicio] = useState(mesVigente.inicio);
  const [dataFim, setDataFim] = useState(mesVigente.fim);
  const [mapaTick, setMapaTick] = useState(0);
  const [efetivadasStore, setEfetivadasStore] = useState<ComissoesEfetivadasStore>({
    linhas: {},
    despesas: {},
  });
  const [efetivando, setEfetivando] = useState(false);

  const logoutPorInatividade = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      limparUltimaAtividadeSessao();
      window.location.href = "/login";
    }
  }, []);

  useSessaoInatividade(() => void logoutPorInatividade());

  const carregarTrabalhos = useCallback(async () => {
    const res = await fetch("/api/trabalhos", { cache: "no-store" });
    const data = await res.json();
    setTrabalhos(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void carregarTrabalhos();
  }, [carregarTrabalhos]);

  useEffect(() => {
    const atualizar = () => {
      void carregarTrabalhos();
    };
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
    return () => window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
  }, [carregarTrabalhos]);

  useEffect(() => {
    function hidratar() {
      try {
        setEfetivadasStore(lerComissoesEfetivadas());
      } catch {
        setEfetivadasStore({ linhas: {}, despesas: {} });
      }
    }
    hidratar();
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, hidratar);
    return () => window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, hidratar);
  }, []);

  useEffect(() => {
    const atualizar = () => {
      setExigeAnteriorFinalizada(
        carregarConfiguracoesGerais().producaoEtapaExigeAnteriorFinalizada
      );
    };
    atualizar();
    window.addEventListener(CONFIG_GERAIS_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(CONFIG_GERAIS_ATUALIZADA_EVENT, atualizar);
  }, []);

  useEffect(() => {
    if (!avisoEtapa) return;
    const timer = window.setTimeout(() => setAvisoEtapa(""), 4000);
    return () => window.clearTimeout(timer);
  }, [avisoEtapa]);

  const itens = osSelecionada
    ? grupoOs.length > 0
      ? itensDoGrupoOs(grupoOs)
      : itensDaOsModulo(osSelecionada)
    : [];
  const itemAtivo =
    itens.find((item) => item.id === itemSelecionado) || (itens.length === 1 ? itens[0] : null);
  const servicoSelecionado = Boolean(osSelecionada && itemAtivo);

  const buscarOrdemServico = useCallback(
    async (termoInformado?: string) => {
      const bruto = (termoInformado ?? buscaOs).trim();
      if (!bruto) return;
      const numero = extrairNumeroOsCodigo(bruto);
      if (!numero) return;
      setBuscaOs(numero);
      setBuscandoOs(true);
      try {
        const response = await fetch(`/api/trabalhos?q=${encodeURIComponent(numero)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        const resultados = Array.isArray(data) ? (data as TrabalhoModuloOs[]) : [];
        setResultadosOs(resultados);
        if (resultados.length === 1) {
          await selecionarOs(resultados[0]);
        } else {
          setOsSelecionada(null);
          setGrupoOs([]);
          setItemSelecionado(null);
        }
      } finally {
        setBuscandoOs(false);
      }
    },
    [buscaOs]
  );

  const chaveEtapasConcluidas =
    osSelecionada && itemAtivo ? `${osSelecionada.id}:${itemAtivo.id}` : "";

  const instrucoesGrupo = grupoOs.map((t) => t.instrucoes || "").join("\n");

  useEffect(() => {
    if (!osSelecionada) {
      setEtapasOs([]);
      setEtapasOk(new Set());
      return;
    }
    const comp = complementosDaOs(grupoOs.length ? grupoOs : [osSelecionada]);
    setEtapasOs(comp.etapas);
  }, [osSelecionada, grupoOs]);

  useEffect(() => {
    if (!chaveEtapasConcluidas) {
      setEtapasOk(new Set());
      return;
    }
    setEtapasOk(etapasConcluidasModulo(chaveEtapasConcluidas));
    setAnotacoes(osSelecionada?.observacoes || "");
  }, [chaveEtapasConcluidas, osSelecionada?.observacoes]);

  useEffect(() => {
    if (!buscaPacienteAberta) return;
    const termo = buscaPaciente.trim();
    if (termo.length < 2) {
      setResultadosOs([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      setBuscandoOs(true);
      try {
        const response = await fetch(`/api/trabalhos?q=${encodeURIComponent(termo)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        setResultadosOs(Array.isArray(data) ? data : []);
      } finally {
        setBuscandoOs(false);
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [buscaPaciente, buscaPacienteAberta]);

  async function carregarGrupoOs(trabalho: TrabalhoModuloOs) {
    try {
      const res = await fetch(`/api/trabalhos/${trabalho.id}`, { cache: "no-store" });
      if (!res.ok) {
        setGrupoOs([trabalho]);
        return trabalho;
      }
      const data = (await res.json()) as TrabalhoModuloOs & { grupo?: TrabalhoModuloOs[] };
      const grupo = Array.isArray(data.grupo) && data.grupo.length > 0 ? data.grupo : [data];
      setGrupoOs(grupo);
      const principal = grupo.find((t) => t.id === trabalho.id) || grupo[0] || trabalho;
      return { ...principal, ...data };
    } catch {
      setGrupoOs([trabalho]);
      return trabalho;
    }
  }

  async function selecionarOs(trabalho: TrabalhoModuloOs) {
    const detalhe = await carregarGrupoOs(trabalho);
    setOsSelecionada(detalhe);
    const lista = itensDaOsModulo(detalhe);
    setItemSelecionado(lista[0]?.id ?? null);
    setBuscaOs(String(detalhe.numeroOs));
  }

  function selecionarItem(item: ItemModuloOs) {
    setItemSelecionado(item.id);
  }

  function alternarEtapa(indice: number) {
    if (!chaveEtapasConcluidas || !osSelecionada) return;
    const etapa = etapasOs.find((e) => e.indice === indice);
    const concluidaAntes = etapasOk.has(indice);
    const validacao = podeAlternarEtapaConcluida({
      indice,
      concluidas: etapasOk,
      totalEtapas: etapasOs.length,
      exigeAnteriorFinalizada,
      marcandoConcluida: !concluidaAntes,
    });
    if (!validacao.permitido) {
      setAvisoEtapa(validacao.motivo || "Não é possível alterar esta etapa agora.");
      return;
    }
    setAvisoEtapa("");
    const indiceAnterior = indiceEtapaAtualDeConcluidas(etapasOk, etapasOs.length);
    const next = new Set(etapasOk);
    if (next.has(indice)) next.delete(indice);
    else next.add(indice);
    const indiceNovo = indiceEtapaAtualDeConcluidas(next, etapasOs.length);
    setEtapasOk(next);
    salvarEtapasConcluidasModulo(chaveEtapasConcluidas, next);
    setMapaTick((n) => n + 1);

    void fetch("/api/relatorios/logs-auditoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: "etapas",
        tipoAlteracao: "alteracao",
        numeroOs: osSelecionada.numeroOs,
        trabalhoId: osSelecionada.id,
        servico: itemAtivo?.descricao || osSelecionada.tipoProtese,
        etapa: etapa?.nome,
        colaborador: etapa?.responsavel || undefined,
        detalhes: [
          {
            campo: etapa?.nome || "Etapa",
            antes: concluidaAntes ? "Concluída" : "Pendente",
            depois: concluidaAntes ? "Pendente" : "Concluída",
          },
        ],
      }),
    }).catch(() => {});

    if (indiceAnterior !== indiceNovo) {
      void fetch("/api/historico-etapas/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trabalhoId: osSelecionada.id,
          itemId: itemAtivo?.id,
          indiceAnterior,
          indiceNovo,
          colaboradorNome: etapa?.responsavel || undefined,
          motivoRetorno: indiceNovo < indiceAnterior ? "Retorno de etapa" : undefined,
        }),
      }).catch(() => {});
    }
  }

  async function salvarAnotacoes() {
    if (!osSelecionada) return;
    setSalvandoAnotacao(true);
    try {
      const res = await fetch(`/api/trabalhos/${osSelecionada.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: anotacoes }),
      });
      if (res.ok) {
        setOsSelecionada((atual) => (atual ? { ...atual, observacoes: anotacoes } : atual));
      }
    } finally {
      setSalvandoAnotacao(false);
    }
  }

  async function atualizarSituacaoItem(novoStatus: string) {
    if (!osSelecionada || !itemAtivo) return;
    const statusAnterior = osSelecionada.status;
    const res = await fetch(`/api/trabalhos/${osSelecionada.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    if (!res.ok) return;
    aplicarControleEntregaAposMudancaStatus(statusAnterior, novoStatus, {
      id: osSelecionada.id,
      numeroOs: osSelecionada.numeroOs,
      tipoProtese: osSelecionada.tipoProtese,
      valor: osSelecionada.valor,
      cliente: osSelecionada.cliente,
    });
    setOsSelecionada({ ...osSelecionada, status: novoStatus });
    setResultadosOs((lista) =>
      lista.map((t) => (t.id === osSelecionada.id ? { ...t, status: novoStatus } : t))
    );
  }

  const colaboradoresCadastro = useMemo(() => carregarColaboradoresListagem(), [trabalhos]);

  function aplicarPeriodo(value: string) {
    setPeriodoFiltro(value);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (value === "todos") {
      setDataInicio("");
      setDataFim("");
      return;
    }
    if (value === "outro") return;
    const inicio = new Date(hoje);
    const fim = new Date(hoje);
    if (value === "semana") {
      const dia = hoje.getDay();
      inicio.setDate(hoje.getDate() - dia);
      fim.setDate(inicio.getDate() + 6);
    } else if (value === "mes") {
      inicio.setDate(1);
      fim.setMonth(hoje.getMonth() + 1, 0);
    }
    setDataInicio(dateToBrShort(inicio));
    setDataFim(dateToBrShort(fim));
  }

  const linhasComissao = useMemo(
    () => montarLinhasComissaoColaboradores(trabalhos),
    [trabalhos, mapaTick]
  );

  const linhasComissaoFiltradas = useMemo(() => {
    return linhasComissao.filter((linha) => {
      if (colaboradorFiltro && linha.colaborador !== colaboradorFiltro) return false;
      if (dataInicio || dataFim) {
        const dataLinha = parseBrDate(linha.dataLancamento);
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
  }, [linhasComissao, colaboradorFiltro, dataInicio, dataFim]);

  const totalComissoes = useMemo(
    () => linhasComissaoFiltradas.reduce((s, l) => s + l.comissaoValor, 0),
    [linhasComissaoFiltradas]
  );

  const nomesFiltroColaboradores = useMemo(() => {
    const nomes = new Set(colaboradoresCadastro.map((c) => c.nome));
    for (const linha of linhasComissao) nomes.add(linha.colaborador);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradoresCadastro, linhasComissao]);

  const linhasOsAtual = useMemo(() => {
    if (!osSelecionada) return [];
    return montarLinhasComissaoColaboradores(grupoOs.length ? grupoOs : [osSelecionada], {
      incluirPendentes: true,
    });
  }, [osSelecionada, grupoOs, mapaTick]);

  const idsEfetivados = useMemo(
    () => new Set(Object.keys(efetivadasStore.linhas)),
    [efetivadasStore]
  );

  async function sincronizarEfetivacao(
    linhasAlvo: LinhaComissaoColaborador[],
    efetivar: boolean
  ) {
    if (linhasAlvo.length === 0 || efetivando) return;
    setEfetivando(true);
    try {
      setEfetivadasStore(await aplicarEfetivacaoComissoes(linhasAlvo, efetivar));
    } catch (err) {
      console.error("efetivar comissao modulo", err);
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
    const ja = linhaComissaoEfetivada(efetivadasStore, linha.id);
    void sincronizarEfetivacao([linha], !ja);
  }

  type LinhaTabela = ItemModuloOs & { _trabalho?: TrabalhoModuloOs };

  const linhasTabela: LinhaTabela[] =
    osSelecionada && itens.length > 0
      ? itens
      : resultadosOs.length > 0 && !osSelecionada
        ? resultadosOs.map((t) => ({
            id: t.id,
            descricao: t.tipoProtese,
            prazo: t.dataPrevista,
            qtd: "1",
            situacao: t.status,
            tipo: "trabalho" as const,
            _trabalho: t,
          }))
        : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-[#333]">
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-5 pb-24">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_250px]">
          <div className="overflow-hidden rounded border border-[#e5e7eb] bg-white">
            <div className="px-5 pb-4 pt-5">
              <label className="mb-2 block text-[13px] font-normal text-[#4b5563]">
                {t("producao.modulo.numeroOs")}
              </label>
              <div className="flex items-center gap-2">
                <InputLeitorCodigoOs
                  value={buscaOs}
                  onChange={setBuscaOs}
                  onCodigoLido={(numero) => void buscarOrdemServico(numero)}
                  placeholder={t("producao.modulo.buscaOsPlaceholder")}
                  className="h-[38px] min-w-0 flex-1 rounded border border-[#d1d5db] px-3 text-[13px] text-[#374151] outline-none focus:border-[#3b82f6]"
                />
                <button
                  type="button"
                  onClick={() => void buscarOrdemServico()}
                  disabled={buscandoOs}
                  className="inline-flex h-[38px] shrink-0 items-center gap-2 rounded bg-[#3b82f6] px-4 text-[13px] font-normal text-white hover:bg-[#2563eb] disabled:opacity-60"
                >
                  <span
                    role="presentation"
                    className="inline-flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLeitorAberto(true);
                    }}
                  >
                    <ScanBarcode className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  {buscandoOs ? t("producao.modulo.buscando") : t("common.buscar")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuscaPaciente("");
                    setBuscaPacienteAberta(true);
                  }}
                  className="inline-flex h-[38px] shrink-0 items-center gap-2 rounded border border-[#93c5fd] bg-white px-4 text-[13px] font-normal text-[#3b82f6] hover:bg-[#eff6ff]"
                >
                  <User className="h-4 w-4" strokeWidth={2} />
                  {t("producao.modulo.pesquisarPaciente")}
                </button>
              </div>
              <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Select
                  label={t("producao.comum.colaboradores")}
                  value={colaboradorFiltro}
                  onChange={(e) => setColaboradorFiltro(e.target.value)}
                  className="h-[38px] !py-1.5"
                >
                  <option value="">{t("common.todos")}</option>
                  {nomesFiltroColaboradores.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </Select>
                <Select
                  label={t("producao.comum.periodo")}
                  value={periodoFiltro}
                  onChange={(e) => aplicarPeriodo(e.target.value)}
                  className="h-[38px] !py-1.5"
                >
                  <option value="mes">{t("producao.comum.periodoMes")}</option>
                  <option value="hoje">{t("producao.comum.periodoHoje")}</option>
                  <option value="semana">{t("producao.comum.periodoSemana")}</option>
                  <option value="todos">{t("producao.comum.periodoTodos")}</option>
                  <option value="outro">{t("producao.comum.periodoOutro")}</option>
                </Select>
                <CampoDataBr
                  label={t("producao.comum.dataInicio")}
                  value={dataInicio}
                  onChange={setDataInicio}
                  onValueChange={() => setPeriodoFiltro("outro")}
                  placeholder="dd/mm/aaaa"
                  inputClassName="h-[38px] !py-0"
                />
                <CampoDataBr
                  label={t("producao.comum.dataFim")}
                  value={dataFim}
                  onChange={setDataFim}
                  onValueChange={() => setPeriodoFiltro("outro")}
                  placeholder="dd/mm/aaaa"
                  inputClassName="h-[38px] !py-0"
                />
              </div>
            </div>

            {osSelecionada ? (
              <div className="mx-5 mb-3 border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[12px] leading-relaxed text-[#1e40af]">
                <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">{t("producao.modulo.ordemServico")}</span>{" "}
                      {osSelecionada.numeroOs}
                    </p>
                    <p>
                      <span className="font-semibold">{t("producao.modulo.cliente")}</span>{" "}
                      {osSelecionada.cliente?.nome || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("producao.modulo.produtos")}</span>{" "}
                      {itens.map((i) => i.descricao).join(", ") || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("producao.modulo.observacaoInterna")}</span>{" "}
                      {osSelecionada.observacoes?.trim() || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">{t("producao.modulo.dataLancamento")}</span>{" "}
                      {formatDateModulo(osSelecionada.dataEntrada)}
                    </p>
                    <p>
                      <span className="font-semibold">{t("producao.modulo.paciente")}</span>{" "}
                      {osSelecionada.paciente?.nome || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">{t("producao.modulo.materiaisDentista")}</span>{" "}
                      {valorLinhaInstrucao(instrucoesGrupo, "Material enviado") ||
                        osSelecionada.material?.trim() ||
                        "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="min-h-[140px] overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-y border-[#e5e7eb] bg-[#f3f4f6]">
                    <th className="w-12 px-3 py-2.5 text-center">
                      <Check className="mx-auto h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />
                    </th>
                    <th className="w-16 px-2 py-2.5 text-center text-[12px] font-semibold uppercase text-[#6b7280]">
                      {t("producao.modulo.tabela.qtd")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold uppercase text-[#6b7280]">
                      {t("producao.modulo.tabela.descricao")}
                    </th>
                    <th className="w-28 px-3 py-2.5 text-left text-[12px] font-semibold uppercase text-[#6b7280]">
                      {t("producao.modulo.tabela.prazo")}
                    </th>
                    <th className="w-32 px-3 py-2.5 text-center text-[12px] font-semibold uppercase text-[#6b7280]">
                      {t("producao.modulo.tabela.situacao")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasTabela.map((linha) => {
                    const ativo =
                      osSelecionada && itemAtivo ? itemAtivo.id === linha.id : false;
                    const statusReal = normalizarChaveStatusOs(
                      linha._trabalho?.status || osSelecionada?.status || linha.situacao
                    );
                    const situacaoMeta = metaStatusTrabalho(statusReal);
                    return (
                      <tr
                        key={linha.id}
                        onClick={() => {
                          if (linha._trabalho) selecionarOs(linha._trabalho);
                          else if (osSelecionada) selecionarItem(linha);
                        }}
                        className={cn(
                          "cursor-pointer border-b border-[#f3f4f6]",
                          ativo && "bg-[#fff7ed]"
                        )}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {ativo ? (
                            <Check className="mx-auto h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-center text-[#374151]">{linha.qtd}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{linha.descricao}</td>
                        <td className="px-3 py-2.5 text-[#6b7280]">
                          {formatDateModulo(linha.prazo)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-[11px] font-semibold",
                              situacaoMeta?.color ?? "bg-slate-100 text-slate-700"
                            )}
                          >
                            {labelStatusTrabalho(t, statusReal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex border-t border-[#e5e7eb]">
              {ABAS_MODULO.map((aba, index) => (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => setAbaAtiva(aba.id)}
                  className={cn(
                    "flex-1 border-r border-[#e5e7eb] py-2.5 text-[12px] font-semibold tracking-wide last:border-r-0",
                    abaAtiva === aba.id
                      ? "rounded-t-sm bg-[#3b82f6] text-white"
                      : "bg-white text-[#6b7280]"
                  )}
                  style={index === 0 && abaAtiva === aba.id ? undefined : undefined}
                >
                  {t(aba.labelKey)}
                </button>
              ))}
            </div>

            {!servicoSelecionado ? (
              <div className="bg-[#fde8d8] py-3 text-center text-[13px] font-normal text-[#e8913a]">
                {t("producao.modulo.semServicoSelecionado")}
              </div>
            ) : (
              <div className="min-h-[200px] bg-white p-4 text-[13px] text-[#374151]">
                {abaAtiva === "etapas" && (
                  <div className="space-y-4">
                    {etapasOs.length === 0 ? (
                      <div className="bg-[#fde8d8] py-3 text-center text-[13px] font-normal text-[#e8913a]">
                        {t("producao.modulo.semEtapasCadastradas")}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {avisoEtapa ? (
                          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                            {avisoEtapa}
                          </div>
                        ) : null}
                        <table className="w-full min-w-[520px] border-collapse text-[12px]">
                          <thead>
                            <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                              <th className="w-10 px-2 py-2 text-center">✓</th>
                              <th className="px-3 py-2 text-left">{t("producao.modulo.etapa")}</th>
                              <th className="px-3 py-2 text-left">{t("producao.modulo.responsavel")}</th>
                              <th className="px-3 py-2 text-left">{t("producao.modulo.tabela.prazo")}</th>
                              <th className="px-3 py-2 text-left">{t("producao.modulo.observacao")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {etapasOs.map((etapa, indiceEtapa) => {
                              const ok = etapasOk.has(indiceEtapa);
                              return (
                                <tr
                                  key={`${indiceEtapa}-${etapa.nome}`}
                                  className="border-b border-[#f3f4f6] hover:bg-[#f9fafb]"
                                >
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => alternarEtapa(indiceEtapa)}
                                      className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center border",
                                        ok
                                          ? "border-[#22c55e] bg-[#22c55e] text-white"
                                          : "border-[#d1d5db] bg-white"
                                      )}
                                      aria-label={
                                        ok
                                          ? t("producao.modulo.etapaConcluida")
                                          : t("producao.modulo.marcarEtapa")
                                      }
                                    >
                                      {ok ? <Check className="h-3 w-3" /> : null}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2 font-medium text-[#374151]">
                                    {etapa.nome}
                                  </td>
                                  <td className="px-3 py-2 text-[#374151]">
                                    {etapa.responsavel || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-[#6b7280]">
                                    {etapa.prazo || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-[#6b7280]">
                                    {etapa.observacao || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div>
                      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
                        {t("producao.modulo.colaboradoresComissoes")}
                      </h3>
                      {linhasOsAtual.length === 0 ? (
                        <p className="rounded border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 text-[12px] text-[#6b7280]">
                          {t("producao.modulo.semColaboradores")}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] border-collapse text-[12px]">
                            <thead>
                              <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                                <th className="px-3 py-2 text-left">{t("producao.comum.colaborador")}</th>
                                <th className="px-3 py-2 text-left">{t("producao.modulo.etapa")}</th>
                                <th className="px-3 py-2 text-left">{t("producao.modulo.situacaoEtapa")}</th>
                                <th className="px-3 py-2 text-right">{t("producao.comum.comissao")}</th>
                                <th className="w-16 px-2 py-2 text-center">{t("producao.modulo.aceitarComissao")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {linhasOsAtual.map((linha) => {
                                const efetivada = idsEfetivados.has(linha.id);
                                const podeAceitar = linha.elegivel && linha.comissaoValor > 0;
                                return (
                                  <tr key={linha.id} className="border-b border-[#f3f4f6]">
                                    <td className="px-3 py-2 font-medium text-[#374151]">
                                      {linha.colaborador}
                                    </td>
                                    <td className="px-3 py-2 text-[#374151]">{linha.etapa || "—"}</td>
                                    <td className="px-3 py-2 text-[#6b7280]">{linha.situacaoEtapa}</td>
                                    <td className="px-3 py-2 text-right font-medium text-[#374151]">
                                      {formatarMoedaComissao(linha.comissaoValor)}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => alternarEfetivacao(linha)}
                                        disabled={efetivando || (!efetivada && !podeAceitar)}
                                        title={
                                          efetivada
                                            ? t("producao.comum.desefetivarComissao")
                                            : t("producao.comum.efetivarComissao")
                                        }
                                        className={cn(
                                          "inline-flex h-6 w-6 items-center justify-center rounded-full",
                                          efetivada
                                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                            : "border border-emerald-400 text-emerald-600 hover:bg-emerald-50",
                                          "disabled:cursor-not-allowed disabled:opacity-40"
                                        )}
                                      >
                                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {abaAtiva === "anotacoes" && (
                  <div className="space-y-3">
                    <textarea
                      value={anotacoes}
                      onChange={(e) => setAnotacoes(e.target.value)}
                      rows={6}
                      className="w-full border border-[#d1d5db] px-3 py-2 text-[13px] outline-none focus:border-[#3b82f6]"
                    />
                    <button
                      type="button"
                      onClick={() => void salvarAnotacoes()}
                      disabled={salvandoAnotacao}
                      className="rounded bg-[#3b82f6] px-4 py-2 text-[13px] text-white"
                    >
                      {salvandoAnotacao ? t("common.salvando") : t("producao.modulo.gravar")}
                    </button>
                  </div>
                )}
                {abaAtiva === "imagens" && (
                  <p className="py-8 text-center text-[#9ca3af]">{t("producao.modulo.semImagens")}</p>
                )}
                {abaAtiva === "detalhes" && osSelecionada && itemAtivo && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoDetalhe label={t("producao.controle.tabela.os")} valor={String(osSelecionada.numeroOs)} />
                    <CampoDetalhe label={t("producao.modulo.servico")} valor={itemAtivo.descricao} />
                    <CampoDetalhe label={t("producao.controle.tabela.paciente")} valor={osSelecionada.paciente?.nome || "—"} />
                    <CampoDetalhe label={t("producao.controle.tabela.cliente")} valor={osSelecionada.cliente?.nome || "—"} />
                    <CampoDetalhe label={t("producao.modulo.dentes")} valor={osSelecionada.dentes || "—"} />
                    <CampoDetalhe label={t("producao.modulo.cor")} valor={osSelecionada.cor || "—"} />
                    <div>
                      <span className="text-[12px] text-[#6b7280]">{t("producao.comum.situacao")}</span>
                      <select
                        value={osSelecionada.status}
                        onChange={(e) => void atualizarSituacaoItem(e.target.value)}
                        className="mt-1 h-[34px] w-full border border-[#d1d5db] px-2 text-[13px]"
                      >
                        {opcoesStatus.map((st) => (
                          <option key={st.value} value={st.value}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="relative rounded border border-[#e5e7eb] bg-white px-4 py-4">
              <p className="text-[13px] font-semibold text-[#374151]">{t("producao.modulo.totalComissoes")}</p>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComissaoVisivel((v) => !v)}
                  className="text-[#9ca3af] hover:text-[#6b7280]"
                  aria-label={
                    comissaoVisivel
                      ? t("producao.modulo.ocultarValor")
                      : t("producao.modulo.mostrarValor")
                  }
                >
                  {comissaoVisivel ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void carregarTrabalhos()}
                  className="text-[#9ca3af] hover:text-[#6b7280]"
                  aria-label={t("producao.modulo.atualizar")}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p
                className={cn(
                  "mt-2 text-[26px] font-semibold leading-none text-[#374151]",
                  !comissaoVisivel && "blur-md select-none"
                )}
              >
                {formatarMoedaComissao(totalComissoes)}
              </p>
              <Link
                href="/app/producao/comissao"
                className="mt-3 inline-block rounded border border-[#3b82f6] px-3 py-1 text-[12px] text-[#3b82f6] hover:bg-[#eff6ff]"
              >
                {t("producao.modulo.verDetalhes")}
              </Link>
              <div className="absolute right-4 top-1/2 flex h-[72px] w-[72px] -translate-y-1/2 items-center justify-center rounded-full bg-[#dbeafe]">
                <DollarSign className="h-9 w-9 text-[#3b82f6]" strokeWidth={1.5} />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded border border-[#e5e7eb] bg-white px-4 py-6">
              <Calendar className="h-6 w-6 text-[#6b7280]" strokeWidth={1.5} />
              <span className="text-[14px] text-[#374151]">{t("producao.modulo.agenda")}</span>
            </div>
          </aside>
        </div>
      </main>

      {buscaPacienteAberta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-28">
          <div className="w-full max-w-md rounded border border-[#e5e7eb] bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <h2 className="text-[14px] font-semibold text-[#374151]">
                {t("producao.modulo.pesquisarPaciente")}
              </h2>
              <button
                type="button"
                onClick={() => setBuscaPacienteAberta(false)}
                aria-label={t("common.fechar")}
              >
                <X className="h-5 w-5 text-[#9ca3af]" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <input
                value={buscaPaciente}
                onChange={(e) => setBuscaPaciente(e.target.value)}
                autoFocus
                placeholder={t("producao.modulo.buscaPacientePlaceholder")}
                className="h-[38px] w-full border border-[#d1d5db] px-3 text-[13px] outline-none focus:border-[#3b82f6]"
              />
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {resultadosOs.map((trabalho) => (
                  <button
                    key={trabalho.id}
                    type="button"
                    onClick={() => {
                      selecionarOs(trabalho);
                      setBuscaPacienteAberta(false);
                    }}
                    className="flex w-full items-center justify-between border border-[#e5e7eb] px-3 py-2 text-left text-[13px] hover:bg-[#eff6ff]"
                  >
                    <span>{trabalho.paciente?.nome || trabalho.cliente?.nome || "—"}</span>
                    <span className="text-[12px] font-semibold text-[#3b82f6]">
                      OS {trabalho.numeroOs}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <LeitorCodigoBarrasModal
        open={leitorAberto}
        onClose={() => setLeitorAberto(false)}
        onCodigoLido={(numero) => void buscarOrdemServico(numero)}
      />
    </div>
  );
}

function CampoDetalhe({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <span className="block text-[12px] text-[#6b7280]">{label}</span>
      <span className="text-[13px] text-[#374151]">{valor}</span>
    </div>
  );
}
