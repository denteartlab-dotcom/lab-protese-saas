"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";
import { ordenarOrdensColunaTv } from "@/components/modulo-tv/lib/ordenar-ordens-tv";
import { TvKanbanColumn } from "@/components/modulo-tv/TvKanbanColumn";
import { TvOsCard } from "@/components/modulo-tv/TvOsCard";
import { TvOsResumoModal } from "@/components/modulo-tv/TvOsResumoModal";
import type { ColunaKanbanId, OrdemServicoTv } from "@/components/modulo-tv/types";
import { isColunaKanbanId } from "@/lib/tv/tv-coluna-override";

type Props = {
  ordens: OrdemServicoTv[];
  carregando: boolean;
  onMoverOrdem: (id: string, coluna: ColunaKanbanId) => void;
};

/** Prefere o ponteiro dentro da coluna; senão o canto mais próximo. */
const detectarColisaoKanban: CollisionDetection = (args) => {
  const dentro = pointerWithin(args);
  if (dentro.length > 0) return dentro;
  return closestCorners(args);
};

/** Resolve a coluna alvo mesmo quando o drop cai sobre outro card. */
function resolverColunaDrop(
  over: Over,
  ordens: OrdemServicoTv[]
): ColunaKanbanId | null {
  const overId = String(over.id);
  if (isColunaKanbanId(overId)) return overId;

  const data = over.data.current as { coluna?: unknown } | undefined;
  if (isColunaKanbanId(data?.coluna)) return data.coluna;

  const ordemAlvo = ordens.find((o) => o.id === overId);
  return ordemAlvo?.coluna ?? null;
}

export function TvKanbanBoard({ ordens, carregando, onMoverOrdem }: Props) {
  const [ordemAtiva, setOrdemAtiva] = useState<OrdemServicoTv | null>(null);
  const [ordemResumo, setOrdemResumo] = useState<OrdemServicoTv | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
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
    const novaColuna = resolverColunaDrop(over, ordens);
    const ordem = ordens.find((o) => o.id === ordemId);
    if (!ordem || !novaColuna || ordem.coluna === novaColuna) return;

    onMoverOrdem(ordemId, novaColuna);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectarColisaoKanban}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid h-full min-h-0 w-full max-w-none grid-cols-6 gap-1.5 overflow-hidden tv-hd:gap-2 tv:gap-2.5">
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
