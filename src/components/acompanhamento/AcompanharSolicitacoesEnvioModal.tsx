"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export type SolicitacaoEnvioPublicaItem = {
  id: string;
  status: string;
  pacienteNome: string;
  tipoProtese: string;
  tipoTransporte: string;
  tipoTransporteLabel?: string;
  motivoRecusa?: string | null;
  criadoEm: string;
  respondidoEm?: string | null;
  dataDesejada?: string | null;
};

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onNovaSolicitacao: () => void;
};

function badgeStatus(
  status: string,
  t: (key: string) => string
): { label: string; className: string } {
  switch (status) {
    case "aprovada":
      return {
        label: t("acompanhamento.pedido.statusAprovada"),
        className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case "recusada":
      return {
        label: t("acompanhamento.pedido.statusRecusada"),
        className: "bg-red-100 text-red-800 border-red-200",
      };
    case "pendente":
    default:
      return {
        label: t("acompanhamento.pedido.statusPendente"),
        className: "bg-amber-100 text-amber-900 border-amber-200",
      };
  }
}

export function AcompanharSolicitacoesEnvioModal({
  open,
  token,
  onClose,
  onNovaSolicitacao,
}: Props) {
  const { t } = useI18n();
  const [lista, setLista] = useState<SolicitacaoEnvioPublicaItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/clientes/public/${token}/solicitacao-envio`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.message || json.error || t("acompanhamento.pedido.erroCarregarLista"));
        setLista([]);
        return;
      }
      setLista(Array.isArray(json.solicitacoes) ? json.solicitacoes : []);
    } catch {
      setErro(t("acompanhamento.pedido.erroCarregarLista"));
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (!open) return;
    void carregar();
  }, [open, carregar]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("acompanhamento.pedido.acompanharTitulo")}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">{t("acompanhamento.pedido.acompanharDesc")}</p>

        {carregando ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {t("acompanhamento.pedido.carregandoLista")}
          </p>
        ) : erro ? (
          <div className="space-y-3 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
            <p>{erro}</p>
            <button
              type="button"
              onClick={() => void carregar()}
              className="text-xs font-semibold underline"
            >
              {t("acompanhamento.pedido.tentarNovamente")}
            </button>
          </div>
        ) : lista.length === 0 ? (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-slate-600">{t("acompanhamento.pedido.semSolicitacoes")}</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNovaSolicitacao();
              }}
              className="inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {t("acompanhamento.pedido.botao")}
            </button>
          </div>
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {lista.map((item) => {
              const badge = badgeStatus(item.status, t);
              const recusada = item.status === "recusada";
              return (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-lg border bg-white p-3 shadow-sm",
                    recusada ? "border-red-200" : "border-slate-200"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {item.pacienteNome}
                      </p>
                      <p className="text-xs text-slate-500">{item.tipoProtese}</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <dl className="mt-2 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-2">
                    <div>
                      <dt className="inline font-medium text-slate-600">
                        {t("acompanhamento.pedido.enviadoEm")}:{" "}
                      </dt>
                      <dd className="inline">{formatDate(item.criadoEm)}</dd>
                    </div>
                    {item.tipoTransporteLabel || item.tipoTransporte ? (
                      <div>
                        <dt className="inline font-medium text-slate-600">
                          {t("acompanhamento.pedido.tipoTransporte")}:{" "}
                        </dt>
                        <dd className="inline">
                          {item.tipoTransporteLabel || item.tipoTransporte}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {item.status === "aprovada" ? (
                    <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {t("acompanhamento.pedido.aprovadaMsg")}
                    </p>
                  ) : null}

                  {item.status === "pendente" ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {t("acompanhamento.pedido.pendenteMsg")}
                    </p>
                  ) : null}

                  {recusada ? (
                    <div className="mt-3 space-y-2 rounded-md border border-red-100 bg-red-50 px-3 py-3">
                      <p className="text-xs font-semibold text-red-800">
                        {t("acompanhamento.pedido.motivoRecusaTitulo")}
                      </p>
                      <p className="text-xs text-red-700">
                        {(item.motivoRecusa || "").trim() ||
                          t("acompanhamento.pedido.motivoRecusaVazio")}
                      </p>
                      <p className="text-xs text-red-800/90">
                        {t("acompanhamento.pedido.recusadaOrientacao")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNovaSolicitacao();
                        }}
                        className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        {t("acompanhamento.pedido.enviarNovamente")}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("cadastros.comum.fechar")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
