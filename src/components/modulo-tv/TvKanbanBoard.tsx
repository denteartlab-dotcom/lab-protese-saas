"use client";

import { useMemo, useState } from "react";
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
import type {
  ColunaKanbanConfig,
  ColunaKanbanId,
  OrdemServicoTv,
} from "@/components/modulo-tv/types";
import { isColunaKanbanId } from "@/lib/tv/tv-coluna-override";
import { cn } from "@/lib/utils";

type Props = {
  ordens: OrdemServicoTv[];
  carregando: boolean;
  onMoverOrdem: (id: string, coluna: ColunaKanbanId) => void;
  colunas?: ColunaKanbanConfig[];
  permitirArrastar?: boolean;
  colunaIdPorOrdem?: (ordem: OrdemServicoTv) => string;
};

function criarDeteccaoColisao(idsColuna: Set<string>): CollisionDetection {
  function idEhAlvoKanban(id: string | number) {
    const s = String(id);
    return idsColuna.has(s) || s.startsWith("drop-");
  }

  function colunaDeCollision(id: string | number, data: unknown): string | null {
    const s = String(id);
    if (idsColuna.has(s)) return s;
    const d = data as { coluna?: unknown } | undefined;
    if (typeof d?.coluna === "string" && idsColuna.has(d.coluna)) return d.coluna;
    return null;
  }

  return (args) => {
    const activeColuna = (args.active.data.current as { coluna?: unknown } | undefined)
      ?.coluna;
    const origem =
      typeof activeColuna === "string" && idsColuna.has(activeColuna)
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
}

/** Resolve a coluna alvo mesmo quando o drop cai sobre outro card. */
function resolverColunaDrop(
  over: Over,
  ordens: OrdemServicoTv[],
  idsColuna: Set<string>,
  colunaIdPorOrdem: (ordem: OrdemServicoTv) => string
): string | null {
  const overId = String(over.id);
  if (idsColuna.has(overId)) return overId;

  const data = over.data.current as { coluna?: unknown } | undefined;
  if (typeof data?.coluna === "string" && idsColuna.has(data.coluna)) {
    return data.coluna;
  }

  if (overId.startsWith("drop-")) {
    const cardId = overId.slice("drop-".length);
    const ordemAlvo = ordens.find((o) => o.id === cardId);
    return ordemAlvo ? colunaIdPorOrdem(ordemAlvo) : null;
  }

  const ordemAlvo = ordens.find((o) => o.id === overId);
  return ordemAlvo ? colunaIdPorOrdem(ordemAlvo) : null;
}

export function TvKanbanBoard({
  ordens,
  carregando,
  onMoverOrdem,
  colunas = COLUNAS_KANBAN,
  permitirArrastar = true,
  colunaIdPorOrdem = (ordem) => ordem.coluna,
}: Props) {
  const [ordemAtiva, setOrdemAtiva] = useState<OrdemServicoTv | null>(null);
  const [ordemResumo, setOrdemResumo] = useState<OrdemServicoTv | null>(null);
  const idsColuna = useMemo(
    () => new Set(colunas.map((coluna) => coluna.id)),
    [colunas]
  );
  const detectarColisao = useMemo(
    () => criarDeteccaoColisao(idsColuna),
    [idsColuna]
  );

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
    if (!permitirArrastar) return;
    const { active, over } = event;
    if (!over) return;

    const ordemId = String(active.id);
    const novaColuna = resolverColunaDrop(over, ordens, idsColuna, colunaIdPorOrdem);
    const ordem = ordens.find((o) => o.id === ordemId);
    if (!ordem || !novaColuna || colunaIdPorOrdem(ordem) === novaColuna) return;
    if (!isColunaKanbanId(novaColuna)) return;

    onMoverOrdem(ordemId, novaColuna);
  }

  function handleDragCancel() {
    setOrdemAtiva(null);
  }

  const n = Math.max(1, colunas.length);
  const muitasColunas = n > 6;

  return (
    <DndContext
      sensors={permitirArrastar ? sensors : []}
      collisionDetection={detectarColisao}
      onDragStart={permitirArrastar ? handleDragStart : undefined}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn(
          "grid h-full min-h-0 w-full max-w-none gap-1.5 overflow-x-auto overflow-y-hidden tv-hd:gap-2 tv:gap-2.5",
          n === 6 && "grid-cols-6"
        )}
        style={
          n === 6
            ? undefined
            : {
                gridTemplateColumns: `repeat(${n}, minmax(${muitasColunas ? "11rem" : "0"}, 1fr))`,
              }
        }
      >
        {colunas.map((coluna) => (
          <TvKanbanColumn
            key={coluna.id}
            coluna={coluna}
            ordens={ordenarOrdensColunaTv(
              ordens.filter((o) => colunaIdPorOrdem(o) === coluna.id)
            )}
            carregando={carregando}
            arrastar={permitirArrastar}
            onAbrirResumo={setOrdemResumo}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {permitirArrastar && ordemAtiva ? (
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
