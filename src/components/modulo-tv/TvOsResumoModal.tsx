"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { TvBadge } from "@/components/modulo-tv/ui/TvBadge";
import { TV_GLASS_PANEL, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { OrdemServicoTv, TvOsResumo } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  ordem: OrdemServicoTv | null;
  onClose: () => void;
};

function CampoResumo({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={TV_TEXT_LABEL}>{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm text-slate-200 tv:text-[15px]",
          destaque && "font-semibold text-white"
        )}
      >
        {valor || "—"}
      </p>
    </div>
  );
}

export function TvOsResumoModal({ ordem, onClose }: Props) {
  const [resumo, setResumo] = useState<TvOsResumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!ordem) {
      setResumo(null);
      setErro("");
      return;
    }

    const controller = new AbortController();
    setCarregando(true);
    setErro("");
    setResumo(null);

    fetch(`/api/tv/ordens/${ordem.id}/resumo`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Falha ao carregar OS");
        }
        return res.json() as Promise<TvOsResumo>;
      })
      .then((data) => setResumo(data))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setErro(e.message || "Erro ao carregar");
      })
      .finally(() => setCarregando(false));

    return () => controller.abort();
  }, [ordem]);

  useEffect(() => {
    if (!ordem) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ordem, onClose]);

  return (
    <AnimatePresence>
      {ordem ? (
        <motion.div
          key="tv-os-resumo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 tv:p-6"
        >
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden",
              TV_GLASS_PANEL,
              "border-slate-600/50 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tv-os-resumo-titulo"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-700/50 px-5 py-4 tv:px-6">
              <div className="min-w-0">
                <p className={TV_TEXT_LABEL}>Resumo da OS</p>
                <h2
                  id="tv-os-resumo-titulo"
                  className="font-tv-mono text-xl font-bold text-white tv:text-2xl"
                >
                  OS {ordem.numeroOs}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-400">
                  {ordem.paciente}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <TvBadge prioridade={ordem.prioridade} />
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-600/50 p-2 text-slate-400 transition hover:border-slate-500 hover:bg-slate-800/80 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="tv-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 tv:px-6 tv:py-5">
              {carregando ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando dados…</span>
                </div>
              ) : null}

              {erro ? (
                <p className="py-12 text-center text-sm text-red-400">{erro}</p>
              ) : null}

              {resumo && !carregando ? (
                <div className="space-y-5">
                  <section className="grid grid-cols-2 gap-4 tv:grid-cols-3 tv:gap-5">
                    <CampoResumo label="Paciente" valor={resumo.paciente} destaque />
                    <CampoResumo label="Dentista" valor={resumo.dentista} />
                    <CampoResumo label="Responsável" valor={resumo.colaborador} />
                    <CampoResumo label="Etapa atual" valor={resumo.colunaLabel} />
                    <CampoResumo
                      label="Prazo"
                      valor={
                        resumo.atrasada
                          ? `${resumo.prazo} · ATRASADA`
                          : resumo.prazo
                      }
                    />
                    <CampoResumo label="Entrada" valor={resumo.dataEntrada} />
                  </section>

                  <section
                    className={cn(
                      "rounded-xl border border-slate-700/40 bg-slate-900/50 p-4"
                    )}
                  >
                    <p className={TV_TEXT_LABEL}>Serviço / Prótese</p>
                    <div className="mt-3 grid grid-cols-2 gap-4 tv:grid-cols-4">
                      <CampoResumo label="Tipo" valor={resumo.tipoProtese} destaque />
                      <CampoResumo label="Dentes" valor={resumo.dentes} />
                      <CampoResumo label="Cor" valor={resumo.cor} />
                      <CampoResumo label="Material" valor={resumo.material} />
                    </div>
                    {(resumo.urgente || resumo.repeticao) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {resumo.urgente ? (
                          <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                            Urgente
                          </span>
                        ) : null}
                        {resumo.repeticao ? (
                          <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                            Repetição
                          </span>
                        ) : null}
                      </div>
                    )}
                  </section>

                  {resumo.itens.length > 0 ? (
                    <section>
                      <p className={cn(TV_TEXT_LABEL, "mb-2")}>Itens da OS</p>
                      <ul className="space-y-2">
                        {resumo.itens.map((item, i) => (
                          <li
                            key={`${item.descricao}-${i}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/35 bg-slate-900/40 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 truncate text-slate-200">
                              {item.descricao}
                            </span>
                            <span className="shrink-0 font-tv-mono text-xs text-slate-500">
                              qtd {item.qtd}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {resumo.etapas.length > 0 ? (
                    <section>
                      <p className={cn(TV_TEXT_LABEL, "mb-2")}>Etapas de produção</p>
                      <ul className="space-y-1.5">
                        {resumo.etapas.map((etapa) => (
                          <li
                            key={etapa.indice}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                              etapa.atual
                                ? "border-cyan-500/40 bg-cyan-950/25 text-cyan-100"
                                : etapa.concluida
                                  ? "border-slate-700/30 bg-slate-900/30 text-slate-400"
                                  : "border-slate-700/35 bg-slate-900/20 text-slate-300"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                                etapa.concluida
                                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                                  : "border-slate-600 text-slate-500"
                              )}
                            >
                              {etapa.concluida ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                etapa.indice + 1
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{etapa.nome}</p>
                              <p className="truncate text-[11px] text-slate-500">
                                {etapa.responsavel}
                                {etapa.prazo !== "—" ? ` · ${etapa.prazo}` : ""}
                              </p>
                            </div>
                            {etapa.atual ? (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                Atual
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {resumo.observacoes ? (
                    <section>
                      <p className={cn(TV_TEXT_LABEL, "mb-2")}>Observações</p>
                      <p className="whitespace-pre-wrap rounded-lg border border-slate-700/35 bg-slate-900/40 p-3 text-sm text-slate-300">
                        {resumo.observacoes}
                      </p>
                    </section>
                  ) : null}

                  <p className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                    Status: <span className="text-slate-200">{resumo.status}</span>
                    {" · "}
                    OS: <span className="text-slate-200">{resumo.statusOs}</span>
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
