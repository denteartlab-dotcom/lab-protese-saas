import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  Home,
  LayoutGrid,
  List,
  Package,
  Send,
  Settings,
  ShoppingCart,
  Tv,
  TrendingDown,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { relatoriosNav } from "@/lib/relatorios-nav";

export type AppNavItem = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export const appNavPrincipal: AppNavItem[] = [
  { href: "/app", labelKey: "nav.inicio", icon: Home },
  { href: "/app/financeiro", labelKey: "nav.financeiro", icon: Wallet },
  { href: "/app/clientes", labelKey: "nav.cadastros", icon: Users },
  { href: "/app/produtos", labelKey: "nav.estoque", icon: Package },
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
  { href: "/app/producao/os", labelKey: "nav.os", icon: ClipboardList },
  { href: "/app/producao/controle", labelKey: "nav.controleProducao", icon: Settings },
  { href: "/app/producao/agenda", labelKey: "nav.agendaProducao", icon: CalendarDays },
  { href: "/app/producao/modulo", labelKey: "nav.moduloProducao", icon: Users },
  { href: "/app/producao/comissao", labelKey: "nav.comissao", icon: HandCoins },
  { href: "/app/producao/finalizadores", labelKey: "nav.finalizadores", icon: Send },
  { href: "/app/producao/entregas", labelKey: "nav.entregas", icon: Package },
  { href: "/app/producao/modulo-tv", labelKey: "nav.moduloTv", icon: Tv },
];

export const financeiroNav: AppNavItem[] = [
  { href: "/app/financeiro?tipo=receita", labelKey: "nav.contasReceber", icon: TrendingUp },
  { href: "/app/financeiro?tipo=despesa", labelKey: "nav.contasPagar", icon: TrendingDown },
  { href: "/app/financeiro?aba=plano-de-contas", labelKey: "nav.planoContas", icon: List },
  { href: "/app/financeiro?aba=conta-bancaria", labelKey: "nav.contaBancaria", icon: CreditCard },
];

export const estoqueNav: AppNavItem[] = [
  { href: "/app/produtos", labelKey: "nav.produtos", icon: Package },
  { href: "/app/orcamentos", labelKey: "nav.orcamentos", icon: FileText },
];

export const cadastrosNav: AppNavItem[] = [
  { href: "/app/clientes", labelKey: "nav.clientes", icon: Users },
  { href: "/app/cadastros/colaboradores", labelKey: "nav.colaboradores", icon: UserPlus },
  { href: "/app/cadastros/fornecedores", labelKey: "nav.fornecedores", icon: ShoppingCart },
  { href: "/app/cadastros/prestadores", labelKey: "nav.prestadores", icon: Send },
  { href: "/app/cadastros/entregadores", labelKey: "nav.entregadores", icon: Truck },
  { href: "/app/cadastros/tabela-precos", labelKey: "nav.tabelaPrecos", icon: FileText },
  { href: "/app/cadastros/setores", labelKey: "nav.setores", icon: LayoutGrid },
  { href: "/app/cadastros/material-dentista", labelKey: "nav.materialDentista", icon: Package },
  { href: "/app/cadastros/etapas", labelKey: "nav.etapas", icon: List },
];

export type AppNavGrupoMobile = {
  id: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  hrefBase: string;
  ativo: (pathname: string) => boolean;
  itens: AppNavItem[];
};

export const gruposNavMobile: AppNavGrupoMobile[] = [
  {
    id: "producao",
    labelKey: "nav.producao",
    icon: ClipboardList,
    hrefBase: "/app/producao",
    ativo: (pathname) =>
      pathname.startsWith("/app/producao") || pathname.startsWith("/app/trabalhos"),
    itens: producaoNav,
  },
  {
    id: "financeiro",
    labelKey: "nav.financeiro",
    icon: Wallet,
    hrefBase: "/app/financeiro",
    ativo: (pathname) => pathname.startsWith("/app/financeiro"),
    itens: financeiroNav,
  },
  {
    id: "cadastros",
    labelKey: "nav.cadastros",
    icon: Users,
    hrefBase: "/app/clientes",
    ativo: (pathname) =>
      pathname.startsWith("/app/clientes") || pathname.startsWith("/app/cadastros"),
    itens: cadastrosNav,
  },
  {
    id: "estoque",
    labelKey: "nav.estoque",
    icon: Package,
    hrefBase: "/app/produtos",
    ativo: (pathname) =>
      pathname.startsWith("/app/produtos") || pathname.startsWith("/app/orcamentos"),
    itens: estoqueNav,
  },
  {
    id: "relatorios",
    labelKey: "nav.relatorios",
    icon: FileText,
    hrefBase: "/app/relatorios",
    ativo: (pathname) => pathname.startsWith("/app/relatorios"),
    itens: relatoriosNav as AppNavItem[],
  },
];
