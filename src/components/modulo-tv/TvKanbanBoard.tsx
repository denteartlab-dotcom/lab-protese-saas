"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
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

const IDS_COLUNA = new Set(COLUNAS_KANBAN.map((c) => c.id));

function idEhAlvoKanban(id: string | number) {
  const s = String(id);
  return IDS_COLUNA.has(s) || s.startsWith("drop-");
}

function colunaDeCollision(id: string | number, data: unknown): string | null {
  const s = String(id);
  if (IDS_COLUNA.has(s)) return s;
  const d = data as { coluna?: unknown } | undefined;
  if (typeof d?.coluna === "string" && IDS_COLUNA.has(d.coluna)) return d.coluna;
  return null;
}

/**
 * Preferência: alvo sob o ponteiro (coluna ou card), evitando grudar na origem;
 * depois interseção / cantos.
 */
const detectarColisaoKanban: CollisionDetection = (args) => {
  const activeColuna = (args.active.data.current as { coluna?: unknown } | undefined)
    ?.coluna;
  const origem =
    typeof activeColuna === "string" && IDS_COLUNA.has(activeColuna)
      ? activeColuna
      : null;

  const filtrar = (lista: ReturnType<typeof pointerWithin>) => {
    const uteis = lista.filter((c) => idEhAlvoKanban(c.id));
    if (!origem || uteis.length === 0) return uteis;
    const outras = uteis.filter((c) => {
      const col = colunaDeCollision(c.id, c.data?.current);
      return col && col !== origem;
    });
    return outras.length > 0 ? outras : uteis;
  };

  const sobPonteiro = filtrar(pointerWithin(args));
  if (sobPonteiro.length > 0) return sobPonteiro;

  const intersecao = filtrar(rectIntersection(args));
  if (intersecao.length > 0) return intersecao;

  return filtrar(closestCorners(args));
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

  if (overId.startsWith("drop-")) {
    const cardId = overId.slice("drop-".length);
    const ordemAlvo = ordens.find((o) => o.id === cardId);
    return ordemAlvo?.coluna ?? null;
  }

  const ordemAlvo = ordens.find((o) => o.id === overId);
  return ordemAlvo?.coluna ?? null;
}

export function TvKanbanBoard({ ordens, carregando, onMoverOrdem }: Props) {
  const [ordemAtiva, setOrdemAtiva] = useState<OrdemServicoTv | null>(null);
  const [ordemResumo, setOrdemResumo] = useState<OrdemServicoTv | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
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

  function handleDragCancel() {
    setOrdemAtiva(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectarColisaoKanban}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
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

      <DragOverlay dropAnimation={null}>
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
