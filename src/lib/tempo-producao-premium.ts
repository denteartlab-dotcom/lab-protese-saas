/** Tokens visuais do relatório premium (mockup SaaS). */
export const PREMIUM = {
  bgPage: "#eef1f6",
  bgCard: "#ffffff",
  border: "#e8ecf2",
  text: "#0f172a",
  textMuted: "#64748b",
  textSoft: "#94a3b8",
  primary: "#7c3aed",
  primaryHover: "#6d28d9",
  sidebar: "#0b1220",
  sidebarActive: "rgba(124, 58, 237, 0.22)",
  shadow: "0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)",
} as const;

const CORES_ETAPA: Record<string, { bg: string; text: string; bar: string }> = {
  recebido: { bg: "bg-slate-100", text: "text-slate-700", bar: "#94a3b8" },
  escaneamento: { bg: "bg-sky-100", text: "text-sky-800", bar: "#38bdf8" },
  design: { bg: "bg-violet-100", text: "text-violet-800", bar: "#8b5cf6" },
  impressão: { bg: "bg-cyan-100", text: "text-cyan-800", bar: "#06b6d4" },
  impressao: { bg: "bg-cyan-100", text: "text-cyan-800", bar: "#06b6d4" },
  prova: { bg: "bg-blue-100", text: "text-blue-800", bar: "#3b82f6" },
  acabamento: { bg: "bg-orange-100", text: "text-orange-800", bar: "#f97316" },
  montagem: { bg: "bg-orange-100", text: "text-orange-800", bar: "#fb923c" },
  entrega: { bg: "bg-emerald-100", text: "text-emerald-800", bar: "#22c55e" },
  entrada: { bg: "bg-indigo-100", text: "text-indigo-800", bar: "#6366f1" },
  modelo: { bg: "bg-purple-100", text: "text-purple-800", bar: "#a855f7" },
};

export function corEtapaPremium(nome: string) {
  const chave = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  for (const [k, v] of Object.entries(CORES_ETAPA)) {
    if (chave.includes(k)) return v;
  }
  return { bg: "bg-violet-100", text: "text-violet-800", bar: "#8b5cf6" };
}

export function iniciaisAvatar(nome: string) {
  const limpo = (nome || "").trim();
  if (!limpo || limpo === "—" || limpo === "-") return "";
  const partes = limpo.split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

export function corAvatar(nome: string) {
  const cores = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
  ];
  let h = 0;
  for (const c of nome) h = (h + c.charCodeAt(0)) % cores.length;
  return cores[h];
}

export function formatarDiasPremium(valor: number) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function labelStatusPremium(status: string) {
  switch (status) {
    case "em_dia":
      return { label: "No prazo", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    case "atencao":
      return { label: "Atenção", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
    case "atrasado":
      return { label: "Atrasada", cls: "bg-red-50 text-red-700 ring-red-200" };
    case "critico":
      return { label: "Crítica", cls: "bg-red-100 text-red-800 ring-red-300" };
    default:
      return { label: status, cls: "bg-slate-50 text-slate-600 ring-slate-200" };
  }
}
