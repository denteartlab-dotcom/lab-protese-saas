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

  // Travado no setor escolhido — não volta sozinho para "todos".
  const valor =
    !selecionado || selecionado === VISTA_TV_TODOS
      ? VISTA_TV_TODOS
      : setores.find((setor) => chaveNomeTv(setor.nome) === chaveNomeTv(selecionado))
          ?.nome ?? selecionado;

  const opcaoTravada =
    valor !== VISTA_TV_TODOS &&
    !setores.some((setor) => chaveNomeTv(setor.nome) === chaveNomeTv(valor));

  return (
    <div className={cn("shrink-0 p-2.5 tv:p-3", TV_SIDEBAR_CARD)}>
      <label
        htmlFor="tv-setor-select"
        className={cn("mb-1.5 block", TV_TEXT_LABEL)}
      >
        {t("producao.tv.setores.titulo")}
      </label>
      <select
        id="tv-setor-select"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-cyan-400/40 bg-[#0a101c] px-2 py-2 text-[11px] font-semibold text-white outline-none transition focus:border-cyan-300 tv:text-xs"
      >
        <option value={VISTA_TV_TODOS}>
          {t("producao.tv.setores.todos")} ({total})
        </option>
        {opcaoTravada ? <option value={valor}>{valor}</option> : null}
        {setores.map((setor) => {
          const qtd = contagens[chaveNomeTv(setor.nome)] ?? 0;
          return (
            <option key={setor.id || setor.nome} value={setor.nome}>
              {setor.nome} ({qtd})
            </option>
          );
        })}
      </select>
    </div>
  );
}
