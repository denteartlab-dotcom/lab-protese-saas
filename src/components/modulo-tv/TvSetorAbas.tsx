"use client";

import { useI18n } from "@/components/i18n-provider";
import { TV_SIDEBAR_CARD, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import { chaveNomeTv, VISTA_TV_TODOS } from "@/lib/tv/tv-colunas-setor";
import type { SetorCadastro } from "@/lib/setores-cadastro";
import { cn } from "@/lib/utils";

type Props = {
  setores: SetorCadastro[];
  selecionado: string;
  onChange: (valor: string) => void;
  contagens?: Record<string, number>;
  total?: number;
};

export function TvSetorAbas({
  setores,
  selecionado,
  onChange,
  contagens = {},
  total = 0,
}: Props) {
  const { t } = useI18n();
  if (setores.length === 0) return null;

  const inicioAtivo = selecionado === VISTA_TV_TODOS;

  return (
    <nav
      className={cn(
        "tv-scrollbar flex w-[9.75rem] shrink-0 flex-col gap-1 overflow-y-auto p-2 tv-hd:w-[10.5rem] tv:w-[11.5rem] tv:p-2.5",
        TV_SIDEBAR_CARD
      )}
      aria-label={t("producao.tv.setores.titulo")}
    >
      <p className={cn("mb-1 px-1", TV_TEXT_LABEL)}>
        {t("producao.tv.setores.titulo")}
      </p>
      <button
        type="button"
        onClick={() => onChange(VISTA_TV_TODOS)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-2 text-left transition tv:px-2.5 tv:py-2.5",
          inicioAtivo
            ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-50"
            : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-bold uppercase tracking-wide tv:text-xs">
            {t("producao.tv.setores.todos")}
          </span>
          <span className="block text-[9px] font-medium normal-case tracking-normal text-slate-500 tv:text-[10px]">
            {t("producao.tv.setores.todosDica")}
          </span>
        </span>
        <span className="font-tv-mono shrink-0 text-xs font-bold tabular-nums">
          {total}
        </span>
      </button>
      {setores.map((setor) => {
        const ativo = chaveNomeTv(selecionado) === chaveNomeTv(setor.nome);
        const qtd = contagens[chaveNomeTv(setor.nome)] ?? 0;
        return (
          <button
            key={setor.id || setor.nome}
            type="button"
            onClick={() => onChange(setor.nome)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition tv:px-2.5 tv:py-2.5",
              ativo
                ? "border-white/25 text-white"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
            )}
            style={
              ativo
                ? {
                    backgroundColor: `${setor.cor || "#22d3ee"}33`,
                    borderColor: setor.cor || "#22d3ee",
                  }
                : undefined
            }
          >
            <span
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: setor.cor || "#94a3b8" }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-bold uppercase tracking-wide tv:text-xs">
                {setor.nome}
              </span>
              <span className="block text-[9px] text-slate-500 tv:text-[10px]">
                {t("producao.tv.setores.etapasDe")}
              </span>
            </span>
            <span className="font-tv-mono shrink-0 text-xs font-bold tabular-nums">
              {qtd}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
