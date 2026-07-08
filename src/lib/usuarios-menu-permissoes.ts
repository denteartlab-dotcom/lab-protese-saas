import {
  cadastrosNav,
  estoqueNav,
  financeiroNav,
  producaoNav,
  type AppNavItem,
} from "@/lib/app-nav";
import { messages, type MessageKey } from "@/lib/i18n/messages";
import { relatoriosNav } from "@/lib/relatorios-nav";
import type { PermissaoCrud, PermissoesUsuario } from "@/lib/usuarios-sistema";
import { usuarioEhProprietario } from "@/lib/usuarios-sistema";

/** Mapa aba de configurações → id do módulo na grade de permissões. */
export const ABA_PERMISSAO_ID: Record<string, string> = {
  dados: "configuracoes-dados",
  cabecalho: "configuracoes-cabecalho",
  logo: "configuracoes-logo",
  idioma: "configuracoes-idioma",
  horario: "configuracoes-horario",
  nfse: "configuracoes-nfse",
  boletos: "configuracoes-boletos",
  gerais: "configuracoes-gerais",
  os: "configuracoes-os",
  faturas: "configuracoes-faturas",
  etiquetas: "configuracoes-etiquetas",
  usuarios: "configuracoes-usuarios",
  backup: "configuracoes-backup",
};

export type MenuPermissaoItem = {
  id: string;
  label: string;
  href: string;
};

export type MenuPermissaoSecao = {
  id: string;
  titulo: string;
  itens: MenuPermissaoItem[];
};

const t = (key: MessageKey) => messages.pt[key];

function idFromHref(href: string) {
  return href
    .replace(/^\/app\//, "")
    .replace(/[?&=]/g, "-")
    .replace(/\/+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function permissaoIdPorHref(href: string): string {
  const abaMatch = href.match(/[?&]aba=([^&]+)/);
  if (href.startsWith("/app/configuracoes/cabecalho")) {
    return "configuracoes-cabecalho";
  }
  if (href.startsWith("/app/configuracoes") && abaMatch?.[1]) {
    return ABA_PERMISSAO_ID[abaMatch[1]] ?? idFromHref(href);
  }
  if (href === "/app" || href === "/app/") return "inicio";
  return idFromHref(href);
}

function itensNav(nav: AppNavItem[]): MenuPermissaoItem[] {
  return nav.map((item) => ({
    id: idFromHref(item.href),
    label: t(item.labelKey),
    href: item.href.split("?")[0],
  }));
}

/** Menus existentes no lab-protese-saas (sem itens Smart que não existem aqui). */
export const SECOES_MENU_PERMISSOES: MenuPermissaoSecao[] = [
  {
    id: "geral",
    titulo: "MENU GERAL",
    itens: [{ id: "inicio", label: t("nav.inicio"), href: "/app" }],
  },
  {
    id: "producao",
    titulo: "MENU PRODUÇÃO",
    itens: itensNav(producaoNav),
  },
  {
    id: "financeiro",
    titulo: "MENU FINANCEIRO",
    itens: itensNav(financeiroNav),
  },
  {
    id: "cadastros",
    titulo: "MENU CADASTROS",
    itens: itensNav(cadastrosNav),
  },
  {
    id: "estoque",
    titulo: "MENU ESTOQUE",
    itens: itensNav(estoqueNav),
  },
  {
    id: "relatorios",
    titulo: "MENU RELATÓRIOS",
    itens: itensNav(
      relatoriosNav.filter((item) => item.href.startsWith("/app/relatorios"))
    ),
  },
  {
    id: "configuracoes",
    titulo: "MENU CONFIGURAÇÕES",
    itens: [
      { id: "configuracoes-dados", label: t("settings.dadosLabTitulo"), href: "/app/configuracoes?aba=dados" },
      { id: "configuracoes-cabecalho", label: t("settings.cabecalho"), href: "/app/configuracoes/cabecalho" },
      { id: "configuracoes-logo", label: t("settings.logo"), href: "/app/configuracoes?aba=logo" },
      { id: "configuracoes-idioma", label: t("settings.idioma"), href: "/app/configuracoes?aba=idioma" },
      { id: "configuracoes-horario", label: t("settings.horario"), href: "/app/configuracoes?aba=horario" },
      { id: "configuracoes-nfse", label: t("settings.nfse"), href: "/app/configuracoes?aba=nfse" },
      { id: "configuracoes-boletos", label: t("settings.boletos"), href: "/app/configuracoes?aba=boletos" },
      { id: "configuracoes-gerais", label: t("settings.gerais"), href: "/app/configuracoes?aba=gerais" },
      { id: "configuracoes-os", label: t("settings.os"), href: "/app/configuracoes?aba=os" },
      { id: "configuracoes-faturas", label: t("settings.faturas"), href: "/app/configuracoes?aba=faturas" },
      { id: "configuracoes-etiquetas", label: t("settings.etiquetas"), href: "/app/configuracoes?aba=etiquetas" },
      { id: "configuracoes-backup", label: t("settings.backup"), href: "/app/configuracoes?aba=backup" },
      { id: "configuracoes-usuarios", label: t("settings.usuarios"), href: "/app/configuracoes?aba=usuarios" },
    ],
  },
  {
    id: "outros",
    titulo: "MENU OUTROS",
    itens: [
      { id: "pacientes", label: "Pacientes", href: "/app/pacientes" },
      { id: "trabalhos", label: "Trabalhos / OS", href: "/app/trabalhos" },
      { id: "alterar-senha", label: t("user.alterarSenha"), href: "/app/alterar-senha" },
    ],
  },
];

export const TODOS_IDS_MENU_PERMISSOES = SECOES_MENU_PERMISSOES.flatMap((s) =>
  s.itens.map((i) => i.id)
);

export function permissoesModulosVazias(): Record<string, PermissaoCrud> {
  const modulos: Record<string, PermissaoCrud> = {};
  for (const id of TODOS_IDS_MENU_PERMISSOES) {
    modulos[id] = { ver: false, criar: false, editar: false, excluir: false };
  }
  return modulos;
}

export function mesclarModulosPermissoes(
  salvos?: Record<string, Partial<PermissaoCrud>>
): Record<string, PermissaoCrud> {
  const base = permissoesModulosVazias();
  if (!salvos) return base;
  for (const id of TODOS_IDS_MENU_PERMISSOES) {
    const item = salvos[id];
    if (!item) continue;
    base[id] = {
      ver: Boolean(item.ver),
      criar: Boolean(item.criar),
      editar: Boolean(item.editar),
      excluir: Boolean(item.excluir),
    };
  }
  return base;
}

export function proprietarioTemTodasPermissoes(): Record<string, PermissaoCrud> {
  const modulos: Record<string, PermissaoCrud> = {};
  for (const id of TODOS_IDS_MENU_PERMISSOES) {
    modulos[id] = { ver: true, criar: true, editar: true, excluir: true };
  }
  return modulos;
}

export function normalizarPermissoesCompletas(
  parcial: Partial<PermissoesUsuario>,
  role?: string
): PermissoesUsuario {
  if (usuarioEhProprietario(role || "")) {
    return {
      setores: parcial.setores ?? [],
      modulos: proprietarioTemTodasPermissoes(),
      situacao: parcial.situacao ?? "ativo",
      permitirRetiradasCarteira: Boolean(parcial.permitirRetiradasCarteira),
      permitirAlterarChavePix: Boolean(parcial.permitirAlterarChavePix),
      permitirAlterarSenha: parcial.permitirAlterarSenha !== false,
      acessoMobile: Boolean(parcial.acessoMobile),
      avatarDataUrl: parcial.avatarDataUrl,
    };
  }
  return {
    setores: parcial.setores ?? [],
    modulos: mesclarModulosPermissoes(parcial.modulos),
    situacao: parcial.situacao === "inativo" ? "inativo" : "ativo",
    permitirRetiradasCarteira: Boolean(parcial.permitirRetiradasCarteira),
    permitirAlterarChavePix: Boolean(parcial.permitirAlterarChavePix),
    permitirAlterarSenha: Boolean(parcial.permitirAlterarSenha),
    acessoMobile: Boolean(parcial.acessoMobile),
    avatarDataUrl: parcial.avatarDataUrl,
  };
}
