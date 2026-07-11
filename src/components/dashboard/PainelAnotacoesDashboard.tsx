"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  adicionarAnotacaoDashboard,
  ANOTACOES_ATUALIZADO_EVENT,
  lerAnotacoesDashboard,
  removerAnotacaoDashboard,
  type AnotacaoDashboard,
} from "@/lib/anotacoes-dashboard";
import { apiFetch } from "@/lib/fetch-client";
import type { Locale } from "@/lib/i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
import {
  lerNotificacoesDescartadas,
  lerNotificacoesLidas,
  salvarNotificacoesDescartadas,
  salvarNotificacoesLidas,
} from "@/lib/notificacoes-client";

function formatarDataAnotacao(iso: string, locale: Locale) {
  const tag = localeDataIntl(locale);
  return new Date(iso).toLocaleString(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function PainelAnotacoesDashboard({
  titulo,
  locale,
}: {
  titulo: string;
  locale: Locale;
}) {
  const { t } = useI18n();
  const [lista, setLista] = useState<AnotacaoDashboard[]>([]);
  const [texto, setTexto] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    void apiFetch<{ name?: string }>("/api/auth/me")
      .then((data) => {
        if (typeof data.name === "string" && data.name.trim()) {
          setUserName(data.name.trim());
        }
      })
      .catch(() => undefined);
  }, []);

  const recarregar = useCallback(() => {
    setLista(lerAnotacoesDashboard());
  }, []);

  useEffect(() => {
    recarregar();
    window.addEventListener(ANOTACOES_ATUALIZADO_EVENT, recarregar);
    return () => window.removeEventListener(ANOTACOES_ATUALIZADO_EVENT, recarregar);
  }, [recarregar]);

  function enviar() {
    const nova = adicionarAnotacaoDashboard(texto, userName || undefined);
    if (!nova) return;
    setTexto("");
    setLista(lerAnotacoesDashboard());
  }

  function excluir(id: string) {
    const notifId = removerAnotacaoDashboard(id);
    salvarNotificacoesLidas(lerNotificacoesLidas().filter((x) => x !== notifId));
    salvarNotificacoesDescartadas(
      lerNotificacoesDescartadas().filter((x) => x !== notifId)
    );
    setLista(lerAnotacoesDashboard());
  }

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm dark:border-slate-700">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-700">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
      </div>
      <div className="flex h-56 flex-col p-3">
        <div className="min-h-0 flex-1 overflow-y-auto rounded border border-slate-100 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/60">
          {lista.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] text-slate-400">
              {t("dashboard.semAnotacoes")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {lista.map((a) => (
                <li key={a.id} className="group flex gap-2 px-3 py-2.5 hover:bg-white dark:hover:bg-slate-800">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-[12px] leading-snug text-slate-700">
                      {a.texto}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {a.autor ? (
                        <>
                          <span className="font-medium text-blue-600">{a.autor}</span>
                          <span className="mx-1">·</span>
                        </>
                      ) : null}
                      {formatarDataAnotacao(a.criadoEm, locale)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => excluir(a.id)}
                    className="flex shrink-0 items-center gap-1 self-start rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    title={t("dashboard.excluirAnotacao")}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("common.excluir")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            className="flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-900"
            placeholder={t("dashboard.adicionarAnotacao")}
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim()}
            className="rounded border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t("dashboard.enviar")}
          </button>
        </div>
      </div>
    </section>
  );
}
