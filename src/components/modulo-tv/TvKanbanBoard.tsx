"use client";

import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";
import { TvKanbanColumn } from "@/components/modulo-tv/TvKanbanColumn";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";

type Props = {
  ordens: OrdemServicoTv[];
  carregando: boolean;
};

export function TvKanbanBoard({ ordens, carregando }: Props) {
  return (
    <div className="flex h-full min-h-0 gap-2 overflow-hidden tv:gap-2.5 tv-4k:gap-3.5">
      {COLUNAS_KANBAN.map((coluna) => (
        <TvKanbanColumn
          key={coluna.id}
          coluna={coluna}
          ordens={ordens.filter((o) => o.coluna === coluna.id)}
          carregando={carregando}
        />
      ))}
    </div>
  );
}
