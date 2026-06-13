"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import type { ClienteAcompanhamentoPublico } from "@/lib/cliente-acompanhamento";
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
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const res = await fetch(`/api/clientes/public/${token}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.message || "Link indisponível.");
        setDados(null);
        return;
      }
      setErro(null);
      setDados(json as ClienteAcompanhamentoPublico);
      setUltimaAtualizacao(new Date());
    } catch {
      setErro("Não foi possível carregar o acompanhamento.");
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
          setUrgenteMsg(json.message || "Não foi possível sinalizar como urgente.");
          return;
        }
        setUrgenteErro(false);
        setUrgenteMsg(json.message || "Trabalho sinalizado como urgente.");
        await carregar(true);
      } catch {
        setUrgenteErro(true);
        setUrgenteMsg("Não foi possível sinalizar como urgente.");
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
          setUrgenteMsg(json.message || "Não foi possível remover a urgência.");
          return;
        }
        setUrgenteErro(false);
        setUrgenteMsg(json.message || "Urgência removida.");
        await carregar(true);
      } catch {
        setUrgenteErro(true);
        setUrgenteMsg("Não foi possível remover a urgência.");
      } finally {
        setUrgenteRemovendo(null);
      }
    },
    [token, carregar]
  );

  const trabalhosFiltrados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados.trabalhos;
    const soNumero = termo.replace(/\D/g, "");
    return dados.trabalhos.filter((t) => {
      const paciente = t.pacienteNome.toLowerCase();
      if (paciente.includes(termo)) return true;
      if (soNumero && String(t.numeroOs).includes(soNumero)) return true;
      return String(t.numeroOs).includes(termo);
    });
  }, [dados, busca]);

  if (carregando && !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Carregando acompanhamento…
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">{erro || "Link inválido."}</p>
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
          Acompanhamento de produção
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dados.cliente.nomeExibicao || dados.cliente.nome}
        </p>
        {ultimaAtualizacao ? (
          <p className="mt-2 text-[11px] text-slate-400">
            Atualizado automaticamente às{" "}
            {ultimaAtualizacao.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-10">
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
              Urgências: {dados.limitesUrgencia.ativos}/{dados.limitesUrgencia.maxAtivos}{" "}
              ativas · {dados.limitesUrgencia.hoje}/{dados.limitesUrgencia.maxPorDia} hoje
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por paciente ou número da OS…"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30"
              />
            </div>
          </>
        ) : null}
        {dados.trabalhos.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nenhum trabalho em andamento no momento.
          </div>
        ) : trabalhosFiltrados.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nenhum trabalho encontrado para &quot;{busca.trim()}&quot;.
          </div>
        ) : (
          trabalhosFiltrados.map((t) => (
            <article
              key={t.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    OS {t.numeroOs}
                  </p>
                  <p className="text-sm font-medium text-slate-800">
                    {t.pacienteNome}
                  </p>
                  <p className="text-[12px] text-slate-500">{t.tipoProtese}</p>
                  {t.etapaAtual ? (
                    <p className="mt-1 text-[11px] font-medium text-[#4a90d9]">
                      Etapa atual: {t.etapaAtual}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {t.urgente ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                      Urgente
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      t.statusColor
                    )}
                  >
                    {t.statusLabel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 text-[11px] text-slate-600">
                <p>
                  <span className="font-semibold text-slate-700">Entrada:</span>{" "}
                  {formatDate(t.dataEntrada)}
                </p>
                {t.dataPrevista ? (
                  <p>
                    <span className="font-semibold text-slate-700">Previsão:</span>{" "}
                    {formatDate(t.dataPrevista)}
                  </p>
                ) : null}
                {t.dataEntrega ? (
                  <p className="col-span-2">
                    <span className="font-semibold text-slate-700">Entrega:</span>{" "}
                    {formatDate(t.dataEntrega)}
                  </p>
                ) : null}
              </div>

              {t.etapas.length > 0 ? (
                <div className="px-4 py-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Etapas de produção
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {t.etapas.map((etapa, idx) => (
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
                              Agora
                            </span>
                          ) : etapa.situacao === "concluida" ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                              Ok
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              Pendente
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
                  Etapas serão exibidas conforme o laboratório atualizar a OS.
                </p>
              )}

              <div className="relative border-t border-slate-100 px-4 py-2">
                <p className="text-[10px] text-slate-400">
                  Última alteração: {formatarDataHora(t.atualizadoEm)}
                </p>
                {t.podeSolicitarUrgente ? (
                  <button
                    type="button"
                    disabled={urgenteEnviando === t.id}
                    onClick={() => void solicitarUrgente(t.id)}
                    className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-60"
                    title="Sinalizar este trabalho como urgente"
                  >
                    {urgenteEnviando === t.id ? "Enviando…" : "⚡ Urgente"}
                  </button>
                ) : t.podeRemoverUrgente ? (
                  <button
                    type="button"
                    disabled={urgenteRemovendo === t.id}
                    onClick={() => void removerUrgente(t.id)}
                    className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                    title="Remover a marcação de urgência deste trabalho"
                  >
                    {urgenteRemovendo === t.id ? "Removendo…" : "Remover urgência"}
                  </button>
                ) : t.urgente ? (
                  <span className="absolute bottom-2 right-3 text-[10px] font-semibold uppercase text-red-600">
                    Sinalizado urgente
                  </span>
                ) : null}
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
