/** Categorias de prazo — mesmas cores do Resumo Geral (sidebar). */
export type CategoriaPrazoTv =
  | "atrasada"
  | "hoje"
  | "amanha"
  | "apos_amanha";

export const CORES_PRAZO_TV: Record<
  CategoriaPrazoTv,
  { hex: string; label: string }
> = {
  atrasada: { hex: "#ef4444", label: "Atrasada" },
  hoje: { hex: "#eab308", label: "Hoje" },
  amanha: { hex: "#3b82f6", label: "Amanhã" },
  apos_amanha: { hex: "#8b5cf6", label: "Após Amanhã" },
};

function inicioDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function diffDiasPrazo(prazoIso: string) {
  const hoje = inicioDia();
  const prazo = inicioDia(new Date(prazoIso));
  return Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000);
}

export function classificarPrazoTv(ordem: {
  prazoIso: string;
  atrasada: boolean;
}): CategoriaPrazoTv {
  if (ordem.atrasada) return "atrasada";
  const diff = diffDiasPrazo(ordem.prazoIso);
  if (diff < 0) return "atrasada";
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanha";
  return "apos_amanha";
}

const ESTILOS_CARD: Record<
  CategoriaPrazoTv,
  { border: string; ring: string; bg: string; shadow: string; prazo: string }
> = {
  atrasada: {
    border: "border-red-500/55",
    ring: "ring-2 ring-red-500/40",
    bg: "bg-red-950/25",
    shadow: "shadow-[0_0_20px_rgba(239,68,68,0.18)]",
    prazo: "text-red-400",
  },
  hoje: {
    border: "border-yellow-500/55",
    ring: "ring-2 ring-yellow-500/40",
    bg: "bg-yellow-950/15",
    shadow: "shadow-[0_0_18px_rgba(234,179,8,0.15)]",
    prazo: "text-yellow-400",
  },
  amanha: {
    border: "border-blue-500/55",
    ring: "ring-2 ring-blue-500/40",
    bg: "bg-blue-950/15",
    shadow: "shadow-[0_0_18px_rgba(59,130,246,0.15)]",
    prazo: "text-blue-400",
  },
  apos_amanha: {
    border: "border-violet-500/55",
    ring: "ring-2 ring-violet-500/40",
    bg: "bg-violet-950/15",
    shadow: "shadow-[0_0_18px_rgba(139,92,246,0.15)]",
    prazo: "text-violet-400",
  },
};

export function estilosCardPrazoTv(categoria: CategoriaPrazoTv) {
  return ESTILOS_CARD[categoria];
}

export function labelPrazoCard(categoria: CategoriaPrazoTv) {
  if (categoria === "atrasada") return "ATRASADA";
  return CORES_PRAZO_TV[categoria].label.toUpperCase();
}
