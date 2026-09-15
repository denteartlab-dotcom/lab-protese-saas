import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  Home,
  LayoutGrid,
  List,
  MessageCircle,
  Package,
  Send,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Tv,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { menuAppSecaoAtiva } from "@/lib/rotas-app";
import { relatoriosNav } from "@/lib/relatorios-nav";

export type AppNavItem = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  emoji?: string;
};

export const appNavPrincipal: AppNavItem[] = [
  { href: "/app", labelKey: "nav.inicio", icon: Home, emoji: "🏠" },
  { href: "/app/financeiro", labelKey: "nav.financeiro", icon: Wallet, emoji: "💰" },
  { href: "/app/clientes", labelKey: "nav.cadastros", icon: Users, emoji: "👥" },
  { href: "/app/produtos", labelKey: "nav.estoque", icon: Package, emoji: "📦" },
];

export const appNavSemDropdown = new Set<MessageKey>([
  "nav.inicio",
  "nav.financeiro",
  "nav.cadastros",
  "nav.estoque",
  "nav.relatorios",
]);

export { relatoriosNav };

export const producaoNav: AppNavItem[] = [
  { href: "/app/producao/os", labelKey: "nav.os", icon: ClipboardList, emoji: "📋" },
  { href: "/app/producao/controle", labelKey: "nav.controleProducao", icon: Settings, emoji: "⚙️" },
  { href: "/app/producao/agenda", labelKey: "nav.agendaProducao", icon: CalendarDays, emoji: "📅" },
  { href: "/app/producao/modulo", labelKey: "nav.moduloProducao", icon: Users, emoji: "🧑‍🔧" },
  { href: "/app/producao/comissao", labelKey: "nav.comissao", icon: HandCoins, emoji: "💸" },
  { href: "/app/producao/finalizadores", labelKey: "nav.finalizadores", icon: Send, emoji: "🚀" },
  { href: "/app/producao/entregas", labelKey: "nav.entregas", icon: Package, emoji: "📦" },
  { href: "/app/producao/modulo-tv", labelKey: "nav.moduloTv", icon: Tv, emoji: "📺" },
];

export const financeiroNav: AppNavItem[] = [
  { href: "/app/financeiro?tipo=receita", labelKey: "nav.contasReceber", icon: TrendingUp, emoji: "📈" },
  { href: "/app/financeiro?aba=boletos", labelKey: "nav.controleBoletos", icon: BarChart3, emoji: "🧾" },
  { href: "/app/financeiro?tipo=despesa", labelKey: "nav.contasPagar", icon: TrendingDown, emoji: "📉" },
  { href: "/app/financeiro?aba=plano-de-contas", labelKey: "nav.planoContas", icon: List, emoji: "🗂️" },
  { href: "/app/financeiro?aba=conta-bancaria", labelKey: "nav.contaBancaria", icon: CreditCard, emoji: "💳" },
];

export const estoqueNav: AppNavItem[] = [
  { href: "/app/produtos", labelKey: "nav.produtos", icon: Package, emoji: "📦" },
  { href: "/app/orcamentos", labelKey: "nav.orcamentos", icon: FileText, emoji: "📝" },
];

export const cadastrosNav: AppNavItem[] = [
  { href: "/app/clientes", labelKey: "nav.clientes", icon: Users, emoji: "😊" },
  { href: "/app/disparos-whatsapp", labelKey: "nav.disparosWhatsapp", icon: MessageCircle, emoji: "💬" },
  { href: "/app/cadastros/colaboradores", labelKey: "nav.colaboradores", icon: UserPlus, emoji: "👷" },
  { href: "/app/cadastros/fornecedores", labelKey: "nav.fornecedores", icon: ShoppingCart, emoji: "🛒" },
  { href: "/app/cadastros/prestadores", labelKey: "nav.prestadores", icon: Send, emoji: "🤝" },
  { href: "/app/cadastros/entregadores", labelKey: "nav.entregadores", icon: Truck, emoji: "🚚" },
  { href: "/app/cadastros/tabela-precos", labelKey: "nav.tabelaPrecos", icon: FileText, emoji: "💲" },
  { href: "/app/cadastros/setores", labelKey: "nav.setores", icon: LayoutGrid, emoji: "🧩" },
  { href: "/app/cadastros/material-dentista", labelKey: "nav.materialDentista", icon: Package, emoji: "🦷" },
  { href: "/app/cadastros/etapas", labelKey: "nav.etapas", icon: List, emoji: "🔢" },
];

export type AppNavGrupoMobile = {
  id: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  emoji: string;
  hrefBase: string;
  ativo: (pathname: string) => boolean;
  itens: AppNavItem[];
};

export const gruposNavMobile: AppNavGrupoMobile[] = [
  {
    id: "producao",
    labelKey: "nav.producao",
    icon: ClipboardList,
    emoji: "🦷",
    hrefBase: "/app/producao",
    ativo: (pathname) => menuAppSecaoAtiva(pathname, ["/producao", "/trabalhos"]),
    itens: producaoNav,
  },
  {
    id: "financeiro",
    labelKey: "nav.financeiro",
    icon: Wallet,
    emoji: "💰",
    hrefBase: "/app/financeiro",
    ativo: (pathname) => menuAppSecaoAtiva(pathname, "/financeiro"),
    itens: financeiroNav,
  },
  {
    id: "cadastros",
    labelKey: "nav.cadastros",
    icon: Users,
    emoji: "👥",
    hrefBase: "/app/clientes",
    ativo: (pathname) => menuAppSecaoAtiva(pathname, ["/clientes", "/cadastros", "/disparos-whatsapp"]),
    itens: cadastrosNav,
  },
  {
    id: "estoque",
    labelKey: "nav.estoque",
    icon: Package,
    emoji: "📦",
    hrefBase: "/app/produtos",
    ativo: (pathname) => menuAppSecaoAtiva(pathname, ["/produtos", "/orcamentos"]),
    itens: estoqueNav,
  },
  {
    id: "relatorios",
    labelKey: "nav.relatorios",
    icon: FileText,
    emoji: "📊",
    hrefBase: "/app/relatorios",
    ativo: (pathname) => menuAppSecaoAtiva(pathname, "/relatorios"),
    itens: relatoriosNav as AppNavItem[],
  },
];
