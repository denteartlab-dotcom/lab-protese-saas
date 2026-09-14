"use client";

import { motion } from "framer-motion";
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

  const valor =
    setores.some((setor) => chaveNomeTv(setor.nome) === chaveNomeTv(selecionado))
      ? setores.find((setor) => chaveNomeTv(setor.nome) === chaveNomeTv(selecionado))
          ?.nome ?? VISTA_TV_TODOS
      : VISTA_TV_TODOS;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.24 }}
      className={cn("p-4 tv:p-5 tv-4k:p-6", TV_SIDEBAR_CARD)}
    >
      <label
        htmlFor="tv-setor-select"
        className={cn("mb-3 block", TV_TEXT_LABEL)}
      >
        {t("producao.tv.setores.titulo")}
      </label>
      <select
        id="tv-setor-select"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-white/15 bg-[#0a101c] px-2.5 py-2 text-[11px] font-semibold text-white outline-none transition focus:border-cyan-400/50 tv:text-xs"
      >
        <option value={VISTA_TV_TODOS}>
          {t("producao.tv.setores.todos")} ({total})
        </option>
        {setores.map((setor) => {
          const qtd = contagens[chaveNomeTv(setor.nome)] ?? 0;
          return (
            <option key={setor.id || setor.nome} value={setor.nome}>
              {setor.nome} ({qtd})
            </option>
          );
        })}
      </select>
      <p className="mt-2 text-[10px] leading-snug text-slate-500 tv:text-[11px]">
        {t("producao.tv.setores.selectDica")}
      </p>
    </motion.div>
  );
}
