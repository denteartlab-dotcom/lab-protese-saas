import {
  cadastrosNav,
  estoqueNav,
  financeiroNav,
  producaoNav,
  type AppNavItem,
} from "@/lib/app-nav";
import type { MessageKey } from "@/lib/i18n";
import { relatoriosNav } from "@/lib/relatorios-nav";
import { permissaoIdPorHref, ABA_PERMISSAO_ID, SECOES_MENU_PERMISSOES } from "@/lib/usuarios-menu-permissoes";
import type { PermissaoCrud } from "@/lib/usuarios-sistema";

export { ABA_PERMISSAO_ID };

export type ItemMenuConfiguracoes = {
  href: string;
  labelKey: MessageKey;
  permissaoId: string;
};

/** Itens do menu engrenagem (Configurações) — mesmos ids da grade de permissões. */
export const ITENS_MENU_CONFIGURACOES: ItemMenuConfiguracoes[] = [
  { href: "/app/configuracoes?aba=dados", labelKey: "settings.dadosLabTitulo", permissaoId: "configuracoes-dados" },
  { href: "/app/configuracoes/cabecalho", labelKey: "settings.cabecalho", permissaoId: "configuracoes-cabecalho" },
  { href: "/app/configuracoes?aba=gerais", labelKey: "settings.gerais", permissaoId: "configuracoes-gerais" },
  { href: "/app/configuracoes?aba=boletos", labelKey: "settings.boletos", permissaoId: "configuracoes-boletos" },
  { href: "/app/configuracoes?aba=os", labelKey: "settings.os", permissaoId: "configuracoes-os" },
  { href: "/app/configuracoes?aba=faturas", labelKey: "settings.faturas", permissaoId: "configuracoes-faturas" },
  { href: "/app/configuracoes?aba=etiquetas", labelKey: "settings.etiquetas", permissaoId: "configuracoes-etiquetas" },
  { href: "/app/configuracoes?aba=usuarios", labelKey: "settings.usuarios", permissaoId: "configuracoes-usuarios" },
  { href: "/app/configuracoes?aba=backup", labelKey: "settings.backup", permissaoId: "configuracoes-backup" },
];

const NAV_COM_QUERY = [...financeiroNav];

const NAV_POR_PATH = [
  ...producaoNav,
  ...cadastrosNav,
  ...estoqueNav,
  ...relatoriosNav,
] as AppNavItem[];

export function podeVerModulo(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>,
  id: string
): boolean {
  if (acessoTotal) return true;
  if (Boolean(modulos[id]?.ver)) return true;
  if (id === "disparos-whatsapp" && Boolean(modulos["configuracoes-mensagens"]?.ver)) return true;
  return false;
}

export function podeVerHref(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>,
  href: string
): boolean {
  if (acessoTotal) return true;
  return podeVerModulo(acessoTotal, modulos, permissaoIdPorHref(href));
}

export function navGrupoTemAcesso(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>,
  itens: AppNavItem[]
): boolean {
  if (acessoTotal) return true;
  return itens.some((item) => podeVerHref(acessoTotal, modulos, item.href));
}

export function primeiroHrefPermitidoNav(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>,
  itens: AppNavItem[]
): string | null {
  const permitido = itens.find((item) => podeVerHref(acessoTotal, modulos, item.href));
  return permitido?.href ?? null;
}

export function temPermissaoAlgumaConfiguracao(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>
): boolean {
  if (acessoTotal) return true;
  return Object.values(ABA_PERMISSAO_ID).some((id) => podeVerModulo(acessoTotal, modulos, id));
}

function parseSearch(search: string) {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

/** Resolve o id de permissão para pathname + query string da rota atual. */
export function permissaoIdPorRota(pathname: string, search = ""): string | null {
  const path = pathname.replace(/\/+$/, "") || "/app";

  if (path === "/app") return "inicio";
  if (path.startsWith("/app/alterar-senha")) return "alterar-senha";
  if (path.startsWith("/app/pacientes")) return "pacientes";
  if (path.startsWith("/app/trabalhos")) return "trabalhos";

  if (path.startsWith("/app/configuracoes/cabecalho")) {
    return "configuracoes-cabecalho";
  }
  if (path.startsWith("/app/configuracoes")) {
    const aba = parseSearch(search).get("aba") || "dados";
    return ABA_PERMISSAO_ID[aba] ?? "configuracoes-dados";
  }

  if (path.startsWith("/app/financeiro")) {
    const params = parseSearch(search);
    const tipo = params.get("tipo");
    const aba = params.get("aba");
    if (tipo) return permissaoIdPorHref(`/app/financeiro?tipo=${tipo}`);
    if (aba) return permissaoIdPorHref(`/app/financeiro?aba=${aba}`);
    return permissaoIdPorHref("/app/financeiro?tipo=receita");
  }

  for (const item of NAV_COM_QUERY) {
    const base = item.href.split("?")[0];
    if (path === base || path.startsWith(`${base}/`)) {
      return permissaoIdPorHref(item.href);
    }
  }

  for (const item of NAV_POR_PATH) {
    const base = item.href.split("?")[0];
    if (path === base || path.startsWith(`${base}/`)) {
      return permissaoIdPorHref(item.href);
    }
  }

  return null;
}

export function podeAcessarRota(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>,
  pathname: string,
  search = ""
): boolean {
  if (acessoTotal) return true;
  const id = permissaoIdPorRota(pathname, search);
  if (!id) return true;
  return podeVerModulo(acessoTotal, modulos, id);
}

/** Primeira rota permitida ao usuário (fallback quando a página atual é bloqueada). */
export function primeiroHrefPermitidoSistema(
  acessoTotal: boolean,
  modulos: Record<string, PermissaoCrud>
): string {
  if (acessoTotal) return "/app";
  for (const secao of SECOES_MENU_PERMISSOES) {
    for (const item of secao.itens) {
      if (podeVerModulo(acessoTotal, modulos, item.id)) {
        return item.href;
      }
    }
  }
  return "/app/alterar-senha";
}
