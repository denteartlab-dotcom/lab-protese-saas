"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type CategoriaDragCtx = {
  ativo: boolean;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

const CategoriaDragContext = createContext<CategoriaDragCtx | null>(null);

type ListaProps = {
  ids: string[];
  ativo: boolean;
  onReorder: (idsOrdenados: string[]) => void;
  children: ReactNode;
};

export function ListaCategoriasPrecoDnd({ ids, ativo, onReorder, children }: ListaProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!ativo) {
    return <div className="space-y-4">{children}</div>;
  }

  function aoFinalizar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const origem = ids.indexOf(String(active.id));
    const destino = ids.indexOf(String(over.id));
    if (origem < 0 || destino < 0) return;
    onReorder(arrayMove(ids, origem, destino));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoFinalizar}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">{children}</div>
      </SortableContext>
    </DndContext>
  );
}

type BlocoProps = {
  id: string;
  ativo: boolean;
  children: ReactNode;
};

export function CategoriaPrecoArrastavel({ id, ativo, children }: BlocoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !ativo });

  const style = ativo
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  return (
    <CategoriaDragContext.Provider value={{ ativo, attributes, listeners }}>
      <section
        ref={ativo ? setNodeRef : undefined}
        style={style}
        className={cn(
          "rounded border bg-white shadow-sm",
          ativo ? "border-emerald-400" : "border-primary-300",
          isDragging && "opacity-80 shadow-lg"
        )}
      >
        {children}
      </section>
    </CategoriaDragContext.Provider>
  );
}

export function AlcaArrastarCategoria() {
  const ctx = useContext(CategoriaDragContext);
  if (!ctx?.ativo) return null;

  return (
    <button
      type="button"
      className="cursor-grab touch-none rounded p-0.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 active:cursor-grabbing"
      aria-label="Arrastar categoria"
      {...ctx.attributes}
      {...ctx.listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
