"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  const token = String(params.token || "");

  const [dados, setDados] = useState<ClienteAcompanhamentoPublico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

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

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-10">
        {dados.trabalhos.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nenhum trabalho em andamento no momento.
          </div>
        ) : (
          dados.trabalhos.map((t) => (
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
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    t.statusColor
                  )}
                >
                  {t.statusLabel}
                </span>
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
                <div className="px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500">
                    Etapas de produção
                  </p>
                  <ul className="space-y-2">
                    {t.etapas.map((etapa, idx) => (
                      <li
                        key={`${etapa.nome}-${idx}`}
                        className={cn(
                          "rounded border px-3 py-2 text-[12px]",
                          etapa.situacao === "atual"
                            ? "border-[#4a90d9]/40 bg-[#4a90d9]/5"
                            : etapa.situacao === "concluida"
                              ? "border-emerald-100 bg-emerald-50/50"
                              : "border-slate-100 bg-slate-50/50"
                        )}
                      >
                        <p className="font-medium text-slate-800">
                          {etapa.nome}
                          {etapa.situacao === "atual" ? (
                            <span className="ml-2 text-[10px] font-semibold uppercase text-[#4a90d9]">
                              Agora
                            </span>
                          ) : etapa.situacao === "concluida" ? (
                            <span className="ml-2 text-[10px] font-semibold uppercase text-emerald-600">
                              Concluída
                            </span>
                          ) : null}
                        </p>
                        {etapa.responsavel ? (
                          <p className="text-slate-500">
                            Responsável: {etapa.responsavel}
                          </p>
                        ) : null}
                        {etapa.prazo ? (
                          <p className="text-slate-500">Prazo: {etapa.prazo}</p>
                        ) : null}
                        {etapa.observacao ? (
                          <p className="text-slate-500">{etapa.observacao}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="px-4 py-3 text-[12px] text-slate-400">
                  Etapas serão exibidas conforme o laboratório atualizar a OS.
                </p>
              )}

              <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
                Última alteração: {formatarDataHora(t.atualizadoEm)}
              </p>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
