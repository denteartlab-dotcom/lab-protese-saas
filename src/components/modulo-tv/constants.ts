import { FRASES_MOTIVACIONAIS_TV } from "@/components/modulo-tv/lib/frases-motivacionais";
import type { ColunaKanbanConfig } from "@/components/modulo-tv/types";

export { FRASES_MOTIVACIONAIS_TV };

export const COLUNAS_KANBAN: ColunaKanbanConfig[] = [
  {
    id: "entrada",
    label: "ENTRADA",
    dot: "bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.7)]",
    bar: "from-blue-500 to-blue-700",
    accent: "from-blue-600/[0.08] to-transparent",
    glow: "shadow-[0_0_24px_rgba(59,130,246,0.08)]",
    border: "border-blue-500/20",
    badge: "bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/30",
    ring: "ring-blue-500/8",
  },
  {
    id: "plano_cera",
    label: "PLANO DE CERA",
    dot: "bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.7)]",
    bar: "from-violet-500 to-purple-700",
    accent: "from-violet-600/[0.08] to-transparent",
    glow: "shadow-[0_0_24px_rgba(139,92,246,0.1)]",
    border: "border-violet-500/20",
    badge: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30",
    ring: "ring-violet-500/8",
  },
  {
    id: "montagem",
    label: "MONTAGEM",
    dot: "bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.7)]",
    bar: "from-orange-500 to-orange-700",
    accent: "from-orange-600/[0.08] to-transparent",
    glow: "shadow-[0_0_24px_rgba(249,115,22,0.08)]",
    border: "border-orange-500/20",
    badge: "bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/30",
    ring: "ring-orange-500/8",
  },
  {
    id: "acrilizacao",
    label: "ACRILIZAÇÃO",
    dot: "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]",
    bar: "from-emerald-500 to-green-700",
    accent: "from-emerald-600/[0.08] to-transparent",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.08)]",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30",
    ring: "ring-emerald-500/8",
  },
  {
    id: "acabamento",
    label: "ACABAMENTO",
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.7)]",
    bar: "from-amber-400 to-yellow-600",
    accent: "from-amber-500/[0.08] to-transparent",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.08)]",
    border: "border-amber-500/20",
    badge: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30",
    ring: "ring-amber-500/8",
  },
  {
    id: "pronto_entrega",
    label: "PRONTO / ENTREGA",
    dot: "bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.7)]",
    bar: "from-teal-400 to-cyan-600",
    accent: "from-teal-600/[0.08] to-transparent",
    glow: "shadow-[0_0_24px_rgba(20,184,166,0.1)]",
    border: "border-teal-500/20",
    badge: "bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30",
    ring: "ring-teal-500/8",
  },
];

export const FRASE_FOOTER = FRASES_MOTIVACIONAIS_TV[0];

export const AUTO_REFRESH_MS = 28_000;
