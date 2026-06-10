"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileImage,
  Loader2,
  X,
} from "lucide-react";
import type { DetalheTempoProducaoOs } from "@/lib/tempo-producao-detalhe";
import {
  PRIORIDADE_TEMPO_PRODUCAO,
  STATUS_TEMPO_PRODUCAO,
} from "@/lib/tempo-producao-relatorio";
import { cn } from "@/lib/utils";

type Props = {
  trabalhoId: string | null;
  onClose: () => void;
};

export function OsDetalheModal({ trabalhoId, onClose }: Props) {
  const [detalhe, setDetalhe] = useState<DetalheTempoProducaoOs | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!trabalhoId) {
      setDetalhe(null);
      return;
    }

    let ativo = true;
    setCarregando(true);
    setErro("");

    fetch(`/api/relatorios/tempo-producao/${trabalhoId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Erro ao carregar");
        if (ativo) setDetalhe(data);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar detalhes.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [trabalhoId]);

  if (!trabalhoId) return null;

  const resumo = detalhe?.resumo;
  const st = resumo ? STATUS_TEMPO_PRODUCAO[resumo.status] : null;
  const pr = resumo ? PRIORIDADE_TEMPO_PRODUCAO[resumo.prioridade] : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 print:hidden">
      <div
        className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="detalhe-os-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
          <div className="min-w-0">
            {carregando ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando detalhes…
              </div>
            ) : resumo ? (
              <>
                <h2 id="detalhe-os-titulo" className="text-lg font-bold text-slate-900 dark:text-white">
                  OS {resumo.numeroOs} — {resumo.paciente}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {resumo.dentista} · {resumo.tipoServico}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {st ? (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", st.bg, st.cor)}>
                      {st.label}
                    </span>
                  ) : null}
                  {pr ? (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", pr.className)}>
                      {pr.label}
                    </span>
                  ) : null}
                  {resumo.diasAtraso > 0 ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-300">
                      {resumo.diasAtraso}d de atraso
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-red-600">{erro || "Não foi possível carregar."}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {detalhe ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metrica label="Dias no laboratório" valor={`${resumo?.diasNoLaboratorio ?? 0}d`} />
                <Metrica label="Parado na etapa" valor={`${resumo?.diasNaEtapaAtual ?? 0}d`} highlight />
                <Metrica label="Prazo" valor={resumo?.prazoCombinadoBr ?? "—"} />
                <Metrica label="Resp. pelo atraso" valor={resumo?.responsavelPeloAtraso ?? "—"} alert />
              </div>

              <section>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Clock className="h-4 w-4 text-primary-600" />
                  Linha do tempo da produção
                </h3>
                <div className="relative space-y-0 pl-6">
                  <div className="absolute bottom-2 left-[11px] top-2 w-0.5 bg-slate-200 dark:bg-slate-600" />
                  {detalhe.timeline.map((etapa) => (
                    <div key={etapa.indice} className="relative pb-5 last:pb-0">
                      <span
                        className={cn(
                          "absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white dark:bg-slate-900",
                          etapa.situacao === "concluida" && "border-emerald-500 text-emerald-600",
                          etapa.situacao === "atual" && "border-primary-500 text-primary-600",
                          etapa.situacao === "aguardando" && "border-slate-300 text-slate-400"
                        )}
                      >
                        {etapa.situacao === "concluida" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : etapa.situacao === "atual" ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </span>
                      <div
                        className={cn(
                          "rounded-xl border px-4 py-3",
                          etapa.situacao === "atual"
                            ? "border-primary-200 bg-primary-50/80 dark:border-primary-800 dark:bg-primary-950/40"
                            : "border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{etapa.nome}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {etapa.situacao === "concluida"
                                ? "Concluída"
                                : etapa.situacao === "atual"
                                  ? "Em andamento"
                                  : "Aguardando"}
                              {etapa.estimado ? " · datas estimadas" : ""}
                            </p>
                          </div>
                          {etapa.diasNaEtapa != null && etapa.situacao !== "aguardando" ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              {etapa.diasNaEtapa}d
                            </span>
                          ) : null}
                        </div>
                        <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-400">Responsável</dt>
                            <dd className="font-medium text-slate-700 dark:text-slate-200">{etapa.responsavel}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Tempo previsto</dt>
                            <dd className="text-slate-700 dark:text-slate-200">{etapa.tempoPrevisto}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Entrada</dt>
                            <dd className="font-mono text-slate-700 dark:text-slate-200">{etapa.entradaBr}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Saída</dt>
                            <dd className="font-mono text-slate-700 dark:text-slate-200">{etapa.saidaBr}</dd>
                          </div>
                        </dl>
                        {etapa.observacao ? (
                          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                            {etapa.observacao}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {(detalhe.observacoes || detalhe.observacoesInternas) && (
                <section className="grid gap-3 sm:grid-cols-2">
                  {detalhe.observacoes ? (
                    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Observações do serviço</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                        {detalhe.observacoes}
                      </p>
                    </div>
                  ) : null}
                  {detalhe.observacoesInternas ? (
                    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Observações internas</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                        {detalhe.observacoesInternas}
                      </p>
                    </div>
                  ) : null}
                </section>
              )}

              {detalhe.anexos.length > 0 ? (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <FileImage className="h-4 w-4" />
                    Fotos e anexos
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detalhe.anexos.map((anexo) => (
                      <a
                        key={anexo.url}
                        href={anexo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm hover:border-primary-300 dark:border-slate-600 dark:bg-slate-800"
                        title={anexo.name}
                      >
                        {anexo.type.startsWith("image/") ? (
                          <img src={anexo.url} alt={anexo.name} className="h-20 w-28 object-cover" />
                        ) : (
                          <div className="flex h-20 w-28 items-center justify-center text-xs text-slate-500">
                            {anexo.name}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        {resumo ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6">
            <Link
              href={`/app/trabalhos/${resumo.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir OS completa
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Fechar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Metrica({
  label,
  valor,
  highlight,
  alert,
}: {
  label: string;
  valor: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        alert
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : highlight
            ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
            : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold",
          alert ? "text-red-700 dark:text-red-300" : "text-slate-800 dark:text-slate-100"
        )}
      >
        {valor}
      </p>
    </div>
  );
}
