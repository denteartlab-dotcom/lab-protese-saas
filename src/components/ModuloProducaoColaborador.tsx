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
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";
import type { MessageKey } from "@/lib/i18n";
import {
  labelStatusTrabalho,
  metaStatusTrabalho,
  opcoesStatusTrabalho,
} from "@/lib/i18n/status-trabalho-i18n";
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
  const [comissaoVisivel, setComissaoVisivel] = useState(false);
  const [avisoEtapa, setAvisoEtapa] = useState("");
  const [exigeAnteriorFinalizada, setExigeAnteriorFinalizada] = useState(
    () => carregarConfiguracoesGerais().producaoEtapaExigeAnteriorFinalizada
  );

  const logoutPorInatividade = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      limparUltimaAtividadeSessao();
      window.location.href = "/login";
    }
  }, []);

  useSessaoInatividade(() => void logoutPorInatividade());

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
                    const situacaoMeta = metaStatusTrabalho(linha.situacao);
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
                            {labelStatusTrabalho(t, linha.situacao)}
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
                {abaAtiva === "etapas" &&
                  (etapasOs.length === 0 ? (
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
                  ))}
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
                  onClick={() => window.location.reload()}
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
                R$ 0,00
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
