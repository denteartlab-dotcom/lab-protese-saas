import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  FileText,
  LineChart,
  Mail,
  Package,
  PieChart,
  Receipt,
  ScrollText,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";

export type RelatorioNavItem = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
};

/** Itens do menu Relatórios (referência Smart Prótese). */
export const relatoriosNav: RelatorioNavItem[] = [
  {
    href: "/app/relatorios/fluxo-de-caixa",
    labelKey: "nav.relatorio.fluxoCaixa",
    icon: LineChart,
  },
  {
    href: "/app/relatorios/dre",
    labelKey: "nav.relatorio.dre",
    icon: PieChart,
  },
  {
    href: "/app/relatorios/margem-contribuicao",
    labelKey: "nav.relatorio.margemContribuicao",
    icon: TrendingUp,
  },
  {
    href: "/app/relatorios/producao",
    labelKey: "nav.relatorio.producao",
    icon: ClipboardList,
  },
  {
    href: "/app/relatorios/curva-abc-clientes",
    labelKey: "nav.relatorio.curvaAbcClientes",
    icon: Users,
  },
  {
    href: "/app/relatorios/controle-entregas",
    labelKey: "nav.relatorio.controleEntregas",
    icon: Truck,
  },
  {
    href: "/app/relatorios/estoque",
    labelKey: "nav.relatorio.estoque",
    icon: Package,
  },
  {
    href: "/app/relatorios/recibos-emitidos",
    labelKey: "nav.relatorio.recibosEmitidos",
    icon: Receipt,
  },
  {
    href: "/app/relatorios/logs-auditoria",
    labelKey: "nav.relatorio.logsAuditoria",
    icon: ScrollText,
  },
  {
    href: "/app/relatorios/logs-email",
    labelKey: "nav.relatorio.logsEmail",
    icon: Mail,
  },
  {
    href: "/app/relatorios/dashboard-gerencial",
    labelKey: "nav.relatorio.dashboardGerencial",
    icon: BarChart3,
  },
];

export const relatoriosSlugs = [
  "fluxo-de-caixa",
  "dre",
  "margem-contribuicao",
  "producao",
  "curva-abc-clientes",
  "controle-entregas",
  "estoque",
  "recibos-emitidos",
  "logs-auditoria",
  "logs-email",
  "dashboard-gerencial",
] as const;

export type RelatorioSlug = (typeof relatoriosSlugs)[number];

const slugParaLabelKey: Record<RelatorioSlug, MessageKey> = {
  "fluxo-de-caixa": "nav.relatorio.fluxoCaixa",
  dre: "nav.relatorio.dre",
  "margem-contribuicao": "nav.relatorio.margemContribuicao",
  producao: "nav.relatorio.producao",
  "curva-abc-clientes": "nav.relatorio.curvaAbcClientes",
  "controle-entregas": "nav.relatorio.controleEntregas",
  estoque: "nav.relatorio.estoque",
  "recibos-emitidos": "nav.relatorio.recibosEmitidos",
  "logs-auditoria": "nav.relatorio.logsAuditoria",
  "logs-email": "nav.relatorio.logsEmail",
  "dashboard-gerencial": "nav.relatorio.dashboardGerencial",
};

export function labelKeyRelatorio(slug: string) {
  return slugParaLabelKey[slug as RelatorioSlug];
}
