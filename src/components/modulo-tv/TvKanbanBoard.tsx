"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";
import { ordenarOrdensColunaTv } from "@/components/modulo-tv/lib/ordenar-ordens-tv";
import { TvKanbanColumn } from "@/components/modulo-tv/TvKanbanColumn";
import { TvOsCard } from "@/components/modulo-tv/TvOsCard";
import { TvOsResumoModal } from "@/components/modulo-tv/TvOsResumoModal";
import type { ColunaKanbanId, OrdemServicoTv } from "@/components/modulo-tv/types";

type Props = {
  ordens: OrdemServicoTv[];
  carregando: boolean;
  onMoverOrdem: (id: string, coluna: ColunaKanbanId) => void;
};

export function TvKanbanBoard({ ordens, carregando, onMoverOrdem }: Props) {
  const [ordemAtiva, setOrdemAtiva] = useState<OrdemServicoTv | null>(null);
  const [ordemResumo, setOrdemResumo] = useState<OrdemServicoTv | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const ordem = ordens.find((o) => o.id === event.active.id);
    setOrdemAtiva(ordem ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setOrdemAtiva(null);
    const { active, over } = event;
    if (!over) return;

    const ordemId = String(active.id);
    const novaColuna = String(over.id) as ColunaKanbanId;
    const ordem = ordens.find((o) => o.id === ordemId);
    if (!ordem || ordem.coluna === novaColuna) return;

    onMoverOrdem(ordemId, novaColuna);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 gap-2 overflow-x-hidden overflow-y-hidden tv:gap-2.5 tv-4k:gap-3">
        {COLUNAS_KANBAN.map((coluna) => (
          <TvKanbanColumn
            key={coluna.id}
            coluna={coluna}
            ordens={ordenarOrdensColunaTv(
              ordens.filter((o) => o.coluna === coluna.id)
            )}
            carregando={carregando}
            onAbrirResumo={setOrdemResumo}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "ease-out" }}>
        {ordemAtiva ? (
          <div className="rotate-1 scale-[1.03] opacity-95 shadow-[0_20px_60px_rgba(59,130,246,0.25)]">
            <TvOsCard ordem={ordemAtiva} index={0} isOverlay />
          </div>
        ) : null}
      </DragOverlay>

      <TvOsResumoModal
        ordem={ordemResumo}
        onClose={() => setOrdemResumo(null)}
      />
    </DndContext>
  );
}
