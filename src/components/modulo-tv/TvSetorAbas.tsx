"use client";

import { useI18n } from "@/components/i18n-provider";
import { chaveNomeTv, VISTA_TV_TODOS } from "@/lib/tv/tv-colunas-setor";
import type { SetorCadastro } from "@/lib/setores-cadastro";
import { cn } from "@/lib/utils";

type Props = {
  setores: SetorCadastro[];
  selecionado: string;
  onChange: (valor: string) => void;
};

export function TvSetorAbas({ setores, selecionado, onChange }: Props) {
  const { t } = useI18n();
  if (setores.length === 0) return null;

  return (
    <div className="flex min-h-0 shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 tv:gap-2">
      <span className="shrink-0 pr-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 tv:text-[10px]">
        {t("producao.tv.setores.titulo")}
      </span>
      <button
        type="button"
        onClick={() => onChange(VISTA_TV_TODOS)}
        className={cn(
          "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition tv:px-3 tv:text-[11px]",
          selecionado === VISTA_TV_TODOS
            ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
            : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"
        )}
      >
        {t("producao.tv.setores.todos")}
      </button>
      {setores.map((setor) => {
        const ativo = chaveNomeTv(selecionado) === chaveNomeTv(setor.nome);
        return (
          <button
            key={setor.id || setor.nome}
            type="button"
            onClick={() => onChange(setor.nome)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition tv:px-3 tv:text-[11px]",
              ativo
                ? "border-white/25 text-white"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"
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
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: setor.cor || "#94a3b8" }}
            />
            {setor.nome}
          </button>
        );
      })}
    </div>
  );
}
