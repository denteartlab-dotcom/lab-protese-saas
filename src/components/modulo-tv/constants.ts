import type { ColunaKanbanConfig } from "@/components/modulo-tv/types";

export const COLUNAS_KANBAN: ColunaKanbanConfig[] = [
  {
    id: "recebido",
    label: "Recebido",
    accent: "from-cyan-500/20 to-cyan-600/5",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.15)]",
    border: "border-cyan-500/30",
    badge: "bg-cyan-500/20 text-cyan-300 ring-cyan-400/40",
  },
  {
    id: "escaneamento",
    label: "Escaneamento",
    accent: "from-sky-500/20 to-blue-600/5",
    glow: "shadow-[0_0_24px_rgba(56,189,248,0.15)]",
    border: "border-sky-500/30",
    badge: "bg-sky-500/20 text-sky-300 ring-sky-400/40",
  },
  {
    id: "design",
    label: "Design / Planejamento",
    accent: "from-violet-500/20 to-purple-600/5",
    glow: "shadow-[0_0_24px_rgba(139,92,246,0.15)]",
    border: "border-violet-500/30",
    badge: "bg-violet-500/20 text-violet-300 ring-violet-400/40",
  },
  {
    id: "impressao",
    label: "Impressão",
    accent: "from-amber-500/20 to-orange-600/5",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    border: "border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300 ring-amber-400/40",
  },
  {
    id: "acabamento",
    label: "Acabamento",
    accent: "from-orange-500/20 to-rose-600/5",
    glow: "shadow-[0_0_24px_rgba(249,115,22,0.15)]",
    border: "border-orange-500/30",
    badge: "bg-orange-500/20 text-orange-300 ring-orange-400/40",
  },
  {
    id: "pronto",
    label: "Pronto / Entrega",
    accent: "from-emerald-500/20 to-green-600/5",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.18)]",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40",
  },
];

export const FRASES_MOTIVACIONAIS = [
  "Excelência em cada detalhe — a qualidade do seu laboratório inspira confiança.",
  "Produção em ritmo: cada etapa concluída é um sorriso entregue.",
  "Time unido, prazos cumpridos, clientes satisfeitos.",
  "Precisão hoje, reputação amanhã.",
  "Monitoramento em tempo real — decisões mais rápidas, menos atrasos.",
];

export const AUTO_REFRESH_MS = 28_000;
