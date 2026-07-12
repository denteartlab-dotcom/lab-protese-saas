"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PackageCheck, Search } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import {
  compararTrabalhosAcompanhamento,
  opcoesFiltroSituacaoAcompanhamento,
  type ClienteAcompanhamentoPublico,
} from "@/lib/cliente-acompanhamento-cliente";
import { fetchPortalPublico } from "@/lib/portal-publico-cliente";
import type { PortalPublicoPaginaAcompanhamento } from "@/lib/portal-publico-types";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { Modal } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

const POLL_MS = 12_000;

function formatarDataHora(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AcompanhamentoClientePage() {
  const { t } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const token = String(params.token || "");

  const [dados, setDados] = useState<ClienteAcompanhamentoPublico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [urgenteEnviando, setUrgenteEnviando] = useState<string | null>(null);
  const [urgenteRemovendo, setUrgenteRemovendo] = useState<string | null>(null);
  const [urgenteMsg, setUrgenteMsg] = useState<string | null>(null);
  const [urgenteErro, setUrgenteErro] = useState(false);
  const [recebidoModalTrabalhoId, setRecebidoModalTrabalhoId] = useState<string | null>(null);
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [recebidoEnviando, setRecebidoEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("todos");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const res = await fetchPortalPublico<PortalPublicoPaginaAcompanhamento>(
        "acompanhamento",
        token
      );
      if (!res.ok) {
        setErro(res.message || res.error || t("acompanhamento.linkIndisponivel"));
        setDados(null);
        return;
      }
      setErro(null);
      setDados(res.dados.entidade);
      setUltimaAtualizacao(new Date());
    } catch {
      setErro(t("acompanhamento.erroCarregar"));
      setDados(null);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
    const id = window.setInterval(() => void carregar(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [carregar]);

  useEffect(() => {
    const os = searchParams.get("os")?.trim();
    if (os) setBusca(os);
  }, [searchParams]);

  const solicitarUrgente = useCallback(
    async (trabalhoId: string) => {
      setUrgenteEnviando(trabalhoId);
      setUrgenteMsg(null);
      setUrgenteErro(false);
      try {
        const res = await fetch(`/api/clientes/public/${token}/urgente`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trabalhoId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setUrgenteErro(true);
          setUrgenteMsg(json.message || t("acompanhamento.erroUrgente"));
          return;
        }
        setUrgenteErro(false);
        setUrgenteMsg(json.message || t("acompanhamento.sucessoUrgente"));
        await carregar(true);
      } catch {
        setUrgenteErro(true);
        setUrgenteMsg(t("acompanhamento.erroUrgente"));
      } finally {
        setUrgenteEnviando(null);
      }
    },
    [token, carregar]
  );

  const removerUrgente = useCallback(
    async (trabalhoId: string) => {
      setUrgenteRemovendo(trabalhoId);
      setUrgenteMsg(null);
      setUrgenteErro(false);
      try {
        const res = await fetch(`/api/clientes/public/${token}/remover-urgente`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trabalhoId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setUrgenteErro(true);
          setUrgenteMsg(json.message || t("acompanhamento.erroRemoverUrgente"));
          return;
        }
        setUrgenteErro(false);
        setUrgenteMsg(json.message || t("acompanhamento.sucessoRemoverUrgente"));
        await carregar(true);
      } catch {
        setUrgenteErro(true);
        setUrgenteMsg(t("acompanhamento.erroRemoverUrgente"));
      } finally {
        setUrgenteRemovendo(null);
      }
    },
    [token, carregar]
  );

  const confirmarRecebido = useCallback(async () => {
    if (!recebidoModalTrabalhoId) return;
    const nome = nomeRecebedor.trim();
    if (nome.length < 2) {
      setUrgenteErro(true);
      setUrgenteMsg(t("acompanhamento.erroNomeRecebedor"));
      return;
    }

    setRecebidoEnviando(true);
    setUrgenteMsg(null);
    setUrgenteErro(false);
    try {
      const res = await fetch(`/api/clientes/public/${token}/recebido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trabalhoId: recebidoModalTrabalhoId,
          nomeRecebedor: nome,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUrgenteErro(true);
        setUrgenteMsg(json.message || t("acompanhamento.erroConfirmarRecebimento"));
        return;
      }
      setUrgenteErro(false);
      setUrgenteMsg(json.message || t("acompanhamento.sucessoRecebimento"));
      setRecebidoModalTrabalhoId(null);
      setNomeRecebedor("");
      await carregar(true);
    } catch {
      setUrgenteErro(true);
      setUrgenteMsg(t("acompanhamento.erroConfirmarRecebimento"));
    } finally {
      setRecebidoEnviando(false);
    }
  }, [token, recebidoModalTrabalhoId, nomeRecebedor, carregar]);

  const opcoesSituacao = useMemo(
    () => (dados ? opcoesFiltroSituacaoAcompanhamento(dados.trabalhos) : []),
    [dados]
  );

  const trabalhosFiltrados = useMemo(() => {
    if (!dados) return [];
    let lista = [...dados.trabalhos];

    if (filtroSituacao !== "todos") {
      lista = lista.filter(
        (t) => normalizarChaveStatusOs(t.status) === filtroSituacao
      );
    }

    const termo = busca.trim().toLowerCase();
    if (termo) {
      const soNumero = termo.replace(/\D/g, "");
      lista = lista.filter((t) => {
        const paciente = t.pacienteNome.toLowerCase();
        if (paciente.includes(termo)) return true;
        if (soNumero && String(t.numeroOs).includes(soNumero)) return true;
        return String(t.numeroOs).includes(termo);
      });
    }

    return lista.sort(compararTrabalhosAcompanhamento);
  }, [dados, busca, filtroSituacao]);

  if (carregando && !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        {t("acompanhamento.carregando")}
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">{erro || t("acompanhamento.linkInvalido")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white px-4 py-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4a90d9]">
          {dados.labNome}
        </p>
        <h1 className="mt-1 text-lg font-medium text-slate-800">
          {t("acompanhamento.titulo")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dados.cliente.nomeExibicao || dados.cliente.nome}
        </p>
        {ultimaAtualizacao ? (
          <p className="mt-2 text-[11px] text-slate-400">
            {t("acompanhamento.atualizadoAs", {
              hora: ultimaAtualizacao.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            })}
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl p-4 pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {dados.trabalhos.length > 0 ? (
            <aside className="md:w-52 md:shrink-0">
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:sticky md:top-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("acompanhamento.situacao")}
                </p>
                <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
                  <button
                    type="button"
                    onClick={() => setFiltroSituacao("todos")}
                    className={cn(
                      "inline-flex shrink-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[12px] font-medium transition md:w-full",
                      filtroSituacao === "todos"
                        ? "border-[#4a90d9] bg-[#4a90d9]/8 text-[#4a90d9]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span>{t("acompanhamento.todos")}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {dados.trabalhos.length}
                    </span>
                  </button>
                  {opcoesSituacao.map((opcao) => (
                    <button
                      key={opcao.chave}
                      type="button"
                      onClick={() => setFiltroSituacao(opcao.chave)}
                      className={cn(
                        "inline-flex shrink-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[12px] font-medium transition md:w-full",
                        filtroSituacao === opcao.chave
                          ? "border-[#4a90d9] bg-[#4a90d9]/8 text-[#4a90d9]"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span className="truncate">{opcao.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {opcao.quantidade}
                      </span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 flex-1 space-y-4">
        {urgenteMsg ? (
          <p
            className={cn(
              "rounded-lg border px-4 py-2 text-[12px]",
              urgenteErro
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            )}
          >
            {urgenteMsg}
          </p>
        ) : null}
        {dados.trabalhos.length > 0 ? (
          <>
            <p className="text-[11px] text-slate-500">
              {t("acompanhamento.urgenciasResumo", {
                ativos: dados.limitesUrgencia.ativos,
                maxAtivos: dados.limitesUrgencia.maxAtivos,
                hoje: dados.limitesUrgencia.hoje,
                maxDia: dados.limitesUrgencia.maxPorDia,
              })}
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("acompanhamento.buscarPlaceholder")}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30"
              />
            </div>
          </>
        ) : null}
        {dados.trabalhos.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {t("acompanhamento.nenhumTrabalho")}
          </div>
        ) : trabalhosFiltrados.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {busca.trim()
              ? t("acompanhamento.nenhumBusca", { termo: busca.trim() })
              : t("acompanhamento.nenhumFiltro")}
          </div>
        ) : (
          trabalhosFiltrados.map((trabalho) => (
            <article
              key={trabalho.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    OS {trabalho.numeroOs}
                  </p>
                  <p className="text-sm font-medium text-slate-800">
                    {trabalho.pacienteNome}
                  </p>
                  <p className="text-[12px] text-slate-500">{trabalho.tipoProtese}</p>
                  {trabalho.etapaAtual ? (
                    <p className="mt-1 text-[11px] font-medium text-[#4a90d9]">
                      {t("acompanhamento.etapaAtual", { etapa: trabalho.etapaAtual })}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {trabalho.urgente ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                      {t("acompanhamento.urgente")}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      trabalho.statusColor
                    )}
                  >
                    {trabalho.statusLabel}
                  </span>
                  {trabalho.historicoRecebimento ? (
                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-[10px] text-teal-800">
                      <p>
                        <span className="font-semibold">{t("acompanhamento.recebidoPor")}</span>{" "}
                        {trabalho.historicoRecebimento.nomeRecebedor}
                      </p>
                      <p>
                        <span className="font-semibold">{t("acompanhamento.em")}</span>{" "}
                        {formatarDataHora(trabalho.historicoRecebimento.registradoEm)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 text-[11px] text-slate-600">
                <p>
                  <span className="font-semibold text-slate-700">{t("acompanhamento.entrada")}</span>{" "}
                  {formatDate(trabalho.dataEntrada)}
                </p>
                {trabalho.dataPrevista ? (
                  <p>
                    <span className="font-semibold text-slate-700">{t("acompanhamento.previsao")}</span>{" "}
                    {formatDate(trabalho.dataPrevista)}
                  </p>
                ) : null}
                {trabalho.dataEntrega ? (
                  <p className="col-span-2">
                    <span className="font-semibold text-slate-700">{t("acompanhamento.entrega")}</span>{" "}
                    {formatDate(trabalho.dataEntrega)}
                  </p>
                ) : null}
              </div>

              {trabalho.etapas.length > 0 ? (
                <div className="px-4 py-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t("acompanhamento.etapasProducao")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trabalho.etapas.map((etapa, idx) => (
                      <div
                        key={`${etapa.nome}-${idx}`}
                        title={[
                          etapa.responsavel
                            ? `Responsável: ${etapa.responsavel}`
                            : null,
                          etapa.prazo ? `Prazo: ${etapa.prazo}` : null,
                          etapa.observacao,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        className={cn(
                          "inline-flex min-w-[6.5rem] max-w-[11rem] flex-col rounded-md border px-2.5 py-1.5 text-[12px] leading-snug",
                          etapa.situacao === "atual"
                            ? "border-[#4a90d9]/45 bg-[#4a90d9]/8 shadow-sm"
                            : etapa.situacao === "concluida"
                              ? "border-emerald-200/70 bg-emerald-50/50"
                              : "border-slate-200/80 bg-slate-50/40"
                        )}
                      >
                        <span className="truncate font-medium text-slate-700">
                          {etapa.nome}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          {etapa.situacao === "atual" ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#4a90d9]">
                              {t("acompanhamento.etapaAgora")}
                            </span>
                          ) : etapa.situacao === "concluida" ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                              {t("acompanhamento.etapaOk")}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              {t("acompanhamento.etapaPendente")}
                            </span>
                          )}
                        </span>
                        {etapa.prazo ? (
                          <span className="mt-0.5 truncate text-[11px] text-slate-500">
                            {etapa.prazo}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="px-4 py-3 text-[12px] text-slate-400">
                  {t("acompanhamento.etapasPendentes")}
                </p>
              )}

              <div className="relative border-t border-slate-100 px-4 py-2">
                <p className="text-[10px] text-slate-400">
                  {t("acompanhamento.ultimaAlteracao", { data: formatarDataHora(trabalho.atualizadoEm) })}
                </p>
                <div className="absolute bottom-2 right-3 flex flex-wrap items-center justify-end gap-2">
                  {trabalho.podeConfirmarRecebido ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRecebidoModalTrabalhoId(trabalho.id);
                        setNomeRecebedor("");
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal-800 shadow-sm transition hover:bg-teal-100"
                      title={t("acompanhamento.recebidoTitulo")}
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      {t("acompanhamento.recebido")}
                    </button>
                  ) : null}
                  {trabalho.podeSolicitarUrgente ? (
                    <button
                      type="button"
                      disabled={urgenteEnviando === trabalho.id}
                      onClick={() => void solicitarUrgente(trabalho.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-60"
                      title={t("acompanhamento.urgenteTitulo")}
                    >
                      {urgenteEnviando === trabalho.id ? t("acompanhamento.enviando") : t("acompanhamento.urgenteBotao")}
                    </button>
                  ) : trabalho.podeRemoverUrgente ? (
                    <button
                      type="button"
                      disabled={urgenteRemovendo === trabalho.id}
                      onClick={() => void removerUrgente(trabalho.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                      title={t("acompanhamento.removerUrgenciaTitulo")}
                    >
                      {urgenteRemovendo === trabalho.id ? t("acompanhamento.removendo") : t("acompanhamento.removerUrgencia")}
                    </button>
                  ) : trabalho.urgente ? (
                    <span className="text-[10px] font-semibold uppercase text-red-600">
                      {t("acompanhamento.sinalizadoUrgente")}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
          </div>
        </div>
      </main>

      <Modal
        open={recebidoModalTrabalhoId !== null}
        onClose={() => {
          if (recebidoEnviando) return;
          setRecebidoModalTrabalhoId(null);
          setNomeRecebedor("");
        }}
        title={t("acompanhamento.confirmarRecebimento")}
        size="sm"
      >
        <p className="mb-4 text-sm text-slate-600">
          {t("acompanhamento.confirmarRecebimentoTexto")}
        </p>
        <label className="block text-xs font-medium text-slate-700">
          {t("acompanhamento.nomeRecebedor")}
          <input
            type="text"
            value={nomeRecebedor}
            onChange={(e) => setNomeRecebedor(e.target.value)}
            placeholder={t("acompanhamento.nomeRecebedorPlaceholder")}
            maxLength={120}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
            disabled={recebidoEnviando}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmarRecebido();
            }}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={recebidoEnviando}
            onClick={() => {
              setRecebidoModalTrabalhoId(null);
              setNomeRecebedor("");
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {t("cadastros.comum.cancelar")}
          </button>
          <button
            type="button"
            disabled={recebidoEnviando}
            onClick={() => void confirmarRecebido()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {recebidoEnviando ? t("acompanhamento.salvando") : t("acompanhamento.confirmarRecebimentoBotao")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
