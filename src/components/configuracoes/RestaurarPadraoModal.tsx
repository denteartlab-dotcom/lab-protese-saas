"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckSquare, Square, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import type { ModuloLimpezaId } from "@/lib/limpar-modulos-laboratorio";

type ModuloApi = {
  id: ModuloLimpezaId;
  label: string;
  descricao: string;
  registros: number;
  temDados: boolean;
  somenteNavegador?: boolean;
  localStorageKeys: string[];
  localStoragePrefixos?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onMensagem?: (texto: string, tipo?: "info" | "sucesso" | "erro") => void;
  onConcluido?: () => void;
};

function contarItensLocalStorage(mod: ModuloApi): number {
  if (typeof window === "undefined") return 0;
  let n = 0;
  for (const key of mod.localStorageKeys) {
    const v = window.localStorage.getItem(key);
    if (v && v !== "[]" && v !== "{}" && v !== "null") n += 1;
  }
  const prefixos = mod.localStoragePrefixos ?? [];
  if (prefixos.length) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (prefixos.some((p) => k.startsWith(p))) {
        const v = window.localStorage.getItem(k);
        if (v && v !== "[]" && v !== "{}") n += 1;
      }
    }
  }
  return n;
}

function limparLocalStorageCliente(
  keys: string[],
  prefixos: string[]
) {
  if (typeof window === "undefined") return;
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
  const remover: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    if (prefixos.some((p) => k.startsWith(p))) remover.push(k);
  }
  for (const k of remover) window.localStorage.removeItem(k);
  if (prefixos.some((p) => p.startsWith("labProteseConfigLaboratorio"))) {
    window.localStorage.removeItem("labProteseConfigLaboratorio");
  }
}

export function RestaurarPadraoModal({
  open,
  onClose,
  onMensagem,
  onConcluido,
}: Props) {
  const { t } = useI18n();
  const [modulos, setModulos] = useState<ModuloApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<ModuloLimpezaId>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/backup/modulos", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        modulos?: ModuloApi[];
        error?: string;
      };
      if (!res.ok) {
        onMensagem?.(data.error || t("settings.restaurarPadraoErroListar"), "erro");
        return;
      }
      setModulos(data.modulos ?? []);
    } catch {
      onMensagem?.(t("settings.restaurarPadraoErroListar"), "erro");
    } finally {
      setCarregando(false);
    }
  }, [onMensagem, t]);

  useEffect(() => {
    if (!open) return;
    setSelecionados(new Set());
    setConfirmar(false);
    setTextoConfirmacao("");
    void carregar();
  }, [open, carregar]);

  const modulosComContagem = useMemo(() => {
    return modulos.map((mod) => {
      const local = contarItensLocalStorage(mod);
      const total = mod.registros + local;
      return {
        ...mod,
        registrosLocal: local,
        totalRegistros: total,
        temDadosEfetivo: mod.temDados || local > 0,
      };
    });
  }, [modulos]);

  function alternar(id: ModuloLimpezaId) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodos() {
    setSelecionados(new Set(modulosComContagem.map((m) => m.id)));
  }

  function limparSelecao() {
    setSelecionados(new Set());
  }

  async function executar() {
    if (selecionados.size === 0) {
      onMensagem?.(t("settings.restaurarPadraoSelecioneModulo"), "erro");
      return;
    }
    if (!confirmar || textoConfirmacao.trim().toUpperCase() !== "APAGAR") {
      onMensagem?.(t("settings.restaurarPadraoConfirmeApagar"), "erro");
      return;
    }

    setProcessando(true);
    try {
      const res = await fetch("/api/backup/limpar-modulos", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-backup-confirmar": "apagar-modulos-selecionados",
        },
        body: JSON.stringify({
          modulos: [...selecionados],
          confirmacao: "apagar-modulos-selecionados",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        localStorageKeys?: string[];
        localStoragePrefixos?: string[];
        apagados?: Record<string, number>;
      };
      if (!res.ok) {
        onMensagem?.(data.error || t("settings.restaurarPadraoErroLimpar"), "erro");
        return;
      }

      limparLocalStorageCliente(
        data.localStorageKeys ?? [],
        data.localStoragePrefixos ?? []
      );

      const totalApagado = Object.values(data.apagados ?? {}).reduce(
        (s, n) => s + (typeof n === "number" ? n : 0),
        0
      );
      onMensagem?.(
        t("settings.restaurarPadraoSucesso").replace("{n}", String(totalApagado)),
        "sucesso"
      );
      onConcluido?.();
      onClose();
      window.setTimeout(() => {
        window.location.href = "/app/configuracoes?aba=backup";
      }, 1500);
    } catch {
      onMensagem?.(t("settings.restaurarPadraoErroLimpar"), "erro");
    } finally {
      setProcessando(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !processando && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restaurar-padrao-titulo"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2
            id="restaurar-padrao-titulo"
            className="pr-8 text-base font-semibold text-slate-800"
          >
            {t("settings.restaurarPadraoTitulo")}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {t("settings.restaurarPadraoDescricao")}
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={processando}
            className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs text-[#4a90d9] hover:underline"
              onClick={selecionarTodos}
              disabled={carregando || processando}
            >
              {t("settings.restaurarPadraoSelecionarTodos")}
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={limparSelecao}
              disabled={carregando || processando}
            >
              {t("settings.restaurarPadraoLimparSelecao")}
            </button>
          </div>

          {carregando ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {t("common.carregando")}
            </p>
          ) : (
            <ul className="space-y-2">
              {modulosComContagem.map((mod) => {
                const marcado = selecionados.has(mod.id);
                return (
                  <li key={mod.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                        marcado
                          ? "border-red-300 bg-red-50/60"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-slate-600">
                        {marcado ? (
                          <CheckSquare className="h-5 w-5 text-red-600" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={marcado}
                        onChange={() => alternar(mod.id)}
                        disabled={processando}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {mod.label}
                          </span>
                          {mod.temDadosEfetivo ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                              {t("settings.restaurarPadraoComDados")}
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              {t("settings.restaurarPadraoSemDados")}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {mod.descricao}
                        </span>
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {mod.registros > 0 && (
                            <span>
                              {t("settings.restaurarPadraoRegistrosBanco").replace(
                                "{n}",
                                String(mod.registros)
                              )}
                            </span>
                          )}
                          {mod.registros > 0 && mod.registrosLocal > 0 && " · "}
                          {mod.registrosLocal > 0 && (
                            <span>
                              {t("settings.restaurarPadraoRegistrosNavegador").replace(
                                "{n}",
                                String(mod.registrosLocal)
                              )}
                            </span>
                          )}
                          {mod.registros === 0 && mod.registrosLocal === 0 && (
                            <span>{t("settings.restaurarPadraoNenhumRegistro")}</span>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs text-red-800">{t("settings.restaurarPadraoAviso")}</p>
          </div>

          <label className="mt-4 block text-xs font-medium text-slate-700">
            {t("settings.restaurarPadraoDigiteApagar")}
            <input
              type="text"
              value={textoConfirmacao}
              onChange={(e) => setTextoConfirmacao(e.target.value)}
              placeholder="APAGAR"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase"
              disabled={processando}
              autoComplete="off"
            />
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={confirmar}
              onChange={(e) => setConfirmar(e.target.checked)}
              className="mt-0.5"
              disabled={processando}
            />
            {t("settings.restaurarPadraoCheckbox")}
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={processando}
          >
            {t("common.cancelar")}
          </Button>
          <Button
            type="button"
            disabled={processando || selecionados.size === 0}
            onClick={() => void executar()}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {processando
              ? t("settings.restaurarPadraoProcessando")
              : t("settings.restaurarPadraoExecutar")}
          </Button>
        </div>
      </div>
    </div>
  );
}
