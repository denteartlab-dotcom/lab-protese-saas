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
import { cn } from "@/lib/utils";

type Props = {
  tabelas: string[];
  tabelaAtiva?: string;
  onReorder: (tabelas: string[]) => void;
  onSelect?: (nome: string) => void;
};

function ItemSortavel({
  nome,
  selecionada,
  onSelect,
}: {
  nome: string;
  selecionada: boolean;
  onSelect?: (nome: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: nome });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded border px-2 py-1.5 text-xs",
        selecionada
          ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-800"
          : "border-slate-200 bg-white text-slate-600",
        isDragging && "opacity-80 shadow-md"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-slate-400 hover:text-emerald-600 active:cursor-grabbing"
        aria-label={`Arrastar ${nome}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onSelect?.(nome)}
        className="min-w-0 flex-1 truncate text-left hover:underline"
      >
        {nome}
      </button>
    </div>
  );
}

export function ListaTabelasArrastavel({
  tabelas,
  tabelaAtiva,
  onReorder,
  onSelect,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function aoFinalizarArraste(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const origem = tabelas.indexOf(String(active.id));
    const destino = tabelas.indexOf(String(over.id));
    if (origem < 0 || destino < 0) return;
    onReorder(arrayMove(tabelas, origem, destino));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoFinalizarArraste}>
      <SortableContext items={tabelas} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {tabelas.map((nome) => (
            <ItemSortavel
              key={nome}
              nome={nome}
              selecionada={nome === tabelaAtiva}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
