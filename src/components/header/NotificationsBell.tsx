"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Trash2 } from "lucide-react";
import type { NotificacaoApi } from "@/app/api/notificacoes/route";
import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n";
import {
  definirNotificacaoSistema,
  lerNotificacoesDescartadas,
  lerNotificacoesLidas,
  mapApiNotificacao,
  notificacaoSistemaAtiva,
  notificacoesAnotacoesLocal,
  notificacoesEstoqueLocal,
  notificacaoSoMarcarLida,
  ANOTACOES_ATUALIZADO_EVENT,
  PRODUTOS_ESTOQUE_EVENT,
  salvarNotificacoesDescartadas,
  salvarNotificacoesLidas,
  type NotificacaoUi,
} from "@/lib/notificacoes-client";
import { cn } from "@/lib/utils";

function formatarDataNotificacao(iso: string, locale: Locale) {
  const tag = locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
  return new Date(iso).toLocaleString(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function NotificationsBell() {
  const { t, locale } = useI18n();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<NotificacaoUi[]>([]);
  const [lidas, setLidas] = useState<string[]>([]);
  const [descartadas, setDescartadas] = useState<string[]>([]);
  const [sistemaOn, setSistemaOn] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [resNotif, resProd] = await Promise.all([
        fetch("/api/notificacoes", { cache: "no-store" }),
        fetch("/api/produtos", { cache: "no-store" }),
      ]);
      const dataNotif = resNotif.ok
        ? ((await resNotif.json()) as { notificacoes: NotificacaoApi[] })
        : { notificacoes: [] };
      const produtos = resProd.ok
        ? ((await resProd.json()) as Array<{ id: string; nome: string }>)
        : [];
      const api = (dataNotif.notificacoes || []).map(mapApiNotificacao);
      const anotacoes = notificacoesAnotacoesLocal();
      const estoque = notificacoesEstoqueLocal(produtos);
      const merged = [...anotacoes, ...estoque, ...api];
      const unicos = new Map<string, NotificacaoUi>();
      for (const n of merged) unicos.set(n.id, n);
      setLista(Array.from(unicos.values()).slice(0, 50));
      setLidas(lerNotificacoesLidas());
      setDescartadas(lerNotificacoesDescartadas());
      setSistemaOn(notificacaoSistemaAtiva());
    } catch {
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const interval = window.setInterval(() => void carregar(), 120_000);
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, carregar);
    window.addEventListener(ANOTACOES_ATUALIZADO_EVENT, carregar);
    window.addEventListener("focus", carregar);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, carregar);
      window.removeEventListener(ANOTACOES_ATUALIZADO_EVENT, carregar);
      window.removeEventListener("focus", carregar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return;
    void carregar();
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto, carregar]);

  const exibir = useMemo(
    () => (sistemaOn ? lista.filter((n) => !descartadas.includes(n.id)) : []),
    [lista, descartadas, sistemaOn]
  );

  const novas = useMemo(
    () => exibir.filter((n) => !lidas.includes(n.id)),
    [exibir, lidas]
  );

  const lidasNoPainel = useMemo(
    () => exibir.filter((n) => lidas.includes(n.id)),
    [exibir, lidas]
  );

  function marcarComoLida(id: string) {
    const next = [...new Set([...lidas, id])];
    salvarNotificacoesLidas(next);
    setLidas(next);
  }

  function aoClicarNotificacao(id: string, fecharPainel = true) {
    marcarComoLida(id);
    if (fecharPainel) setAberto(false);
  }

  const conteudoNotificacao = (n: NotificacaoUi, lida: boolean) => (
    <>
      <AlertTriangle
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          lida ? "fill-[#4cae4c] text-[#449d44]" : "fill-amber-400 text-amber-600"
        )}
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <strong className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
            {t(n.tituloKey)}
          </strong>
          <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-400">
            {formatarDataNotificacao(n.criadoEm, locale)}
          </span>
        </div>
        <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {t(n.kind, n.params)}
        </p>
      </div>
    </>
  );

  /** Remove do painel só as notificações já lidas (ícone verde), como no Smart Prótese. */
  function limparNotificacoesLidas() {
    if (lidasNoPainel.length === 0) return;
    const ids = lidasNoPainel.map((n) => n.id);
    const next = [...new Set([...descartadas, ...ids])];
    salvarNotificacoesDescartadas(next);
    setDescartadas(next);
  }

  function toggleSistema() {
    const prox = !sistemaOn;
    setSistemaOn(prox);
    definirNotificacaoSistema(prox);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800",
          aberto && "bg-slate-100 dark:bg-slate-800"
        )}
        aria-expanded={aberto}
        aria-label={t("header.notificacoes")}
        title={t("header.notificacoes")}
      >
        <Bell className="h-5 w-5" />
        {novas.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#4a90d9] px-1 text-[10px] font-bold leading-none text-white">
            {novas.length > 9 ? "9+" : novas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-1.5rem,400px)] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="text-[13px] font-normal text-slate-800 dark:text-slate-100">
              {t("header.notificacoesPainel")}
            </h3>
            {novas.length > 0 && (
              <span className="rounded bg-[#4a90d9] px-2 py-0.5 text-[11px] font-medium text-white">
                {t("header.notificacoesNovas", { n: novas.length })}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-[12px] text-slate-600 dark:text-slate-300">
              {t("header.notifSistema")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={sistemaOn}
              onClick={toggleSistema}
              className={cn(
                "relative h-5 w-9 rounded-full transition",
                sistemaOn ? "bg-[#4a90d9]" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                  sistemaOn ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
          </div>

          <div className="max-h-[min(50vh,380px)] overflow-y-auto">
            {!sistemaOn ? (
              <p className="px-4 py-6 text-center text-[12px] text-slate-500">
                {t("header.notifSistemaOff")}
              </p>
            ) : carregando && exibir.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-slate-400">…</p>
            ) : exibir.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-slate-500">
                {t("header.semNotificacoes")}
              </p>
            ) : (
              <ul>
                {exibir.map((n) => {
                  const lida = lidas.includes(n.id);
                  const somenteMarcar = notificacaoSoMarcarLida(n);
                  const className =
                    "flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50/80 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800/60";
                  return (
                    <li key={n.id}>
                      {somenteMarcar ? (
                        <button
                          type="button"
                          onClick={() => aoClicarNotificacao(n.id, false)}
                          className={className}
                        >
                          {conteudoNotificacao(n, lida)}
                        </button>
                      ) : (
                        <Link
                          href={n.href}
                          onClick={() => aoClicarNotificacao(n.id)}
                          className={className}
                        >
                          {conteudoNotificacao(n, lida)}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={limparNotificacoesLidas}
            disabled={lidasNoPainel.length === 0}
            className="flex w-full items-center justify-center gap-2 bg-[#4a90d9] py-2.5 text-[13px] font-normal text-white transition hover:bg-[#3d7fc4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            {t("header.limparNotificacoes")}
          </button>
        </div>
      )}
    </div>
  );
}
