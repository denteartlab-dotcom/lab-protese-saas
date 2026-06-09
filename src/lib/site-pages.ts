import type { MessageKey } from "@/lib/i18n";

export type SitePageEntry = {
  href: string;
  labelKey: MessageKey;
  /** Palavras extras para busca (pt). */
  keywords?: string[];
  sectionKey?: MessageKey;
};

/** Páginas pesquisáveis do sistema (menu + configurações). */
export const SITE_PAGES: SitePageEntry[] = [
  { href: "/app", labelKey: "nav.inicio", keywords: ["home", "dashboard", "painel"] },
  { href: "/app/producao/os", labelKey: "nav.os", sectionKey: "nav.producao", keywords: ["os", "ordem", "servico"] },
  { href: "/app/producao/controle", labelKey: "nav.controleProducao", sectionKey: "nav.producao" },
  { href: "/app/producao/agenda", labelKey: "nav.agendaProducao", sectionKey: "nav.producao" },
  { href: "/app/producao/modulo", labelKey: "nav.moduloProducao", sectionKey: "nav.producao" },
  {
    href: "/app/producao/modulo-tv",
    labelKey: "nav.moduloTv",
    sectionKey: "nav.producao",
    keywords: ["tv", "televisao", "painel"],
  },
  { href: "/app/producao/comissao", labelKey: "nav.comissao", sectionKey: "nav.producao" },
  { href: "/app/producao/finalizadores", labelKey: "nav.finalizadores", sectionKey: "nav.producao" },
  { href: "/app/producao/entregas", labelKey: "nav.entregas", sectionKey: "nav.producao" },
  { href: "/app/financeiro?tipo=receita", labelKey: "nav.contasReceber", sectionKey: "nav.financeiro" },
  { href: "/app/financeiro?tipo=despesa", labelKey: "nav.contasPagar", sectionKey: "nav.financeiro" },
  { href: "/app/financeiro?aba=plano-de-contas", labelKey: "nav.planoContas", sectionKey: "nav.financeiro" },
  { href: "/app/financeiro?aba=conta-bancaria", labelKey: "nav.contaBancaria", sectionKey: "nav.financeiro" },
  { href: "/app/clientes", labelKey: "nav.clientes", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/colaboradores", labelKey: "nav.colaboradores", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/fornecedores", labelKey: "nav.fornecedores", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/prestadores", labelKey: "nav.prestadores", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/entregadores", labelKey: "nav.entregadores", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/tabela-precos", labelKey: "nav.tabelaPrecos", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/setores", labelKey: "nav.setores", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/material-dentista", labelKey: "nav.materialDentista", sectionKey: "nav.cadastros" },
  { href: "/app/cadastros/etapas", labelKey: "nav.etapas", sectionKey: "nav.cadastros" },
  { href: "/app/produtos", labelKey: "nav.produtos", sectionKey: "nav.estoque" },
  { href: "/app/orcamentos", labelKey: "nav.orcamentos", sectionKey: "nav.estoque" },
  { href: "/app/pacientes", labelKey: "nav.clientes", keywords: ["paciente", "pacientes"] },
  { href: "/app/trabalhos", labelKey: "nav.os", keywords: ["trabalhos", "lista os"] },
  { href: "/app/configuracoes?aba=dados", labelKey: "settings.dadosLabTitulo", sectionKey: "settings.titulo" },
  { href: "/app/configuracoes?aba=logo", labelKey: "settings.logo", sectionKey: "settings.titulo" },
  { href: "/app/configuracoes?aba=idioma", labelKey: "settings.idioma", sectionKey: "settings.titulo" },
  { href: "/app/configuracoes?aba=horario", labelKey: "settings.horario", sectionKey: "settings.titulo" },
  { href: "/app/configuracoes?aba=nfse", labelKey: "settings.nfse", sectionKey: "settings.titulo" },
];

export function filtrarPaginasSite(
  termo: string,
  traduzir: (key: MessageKey) => string
): SitePageEntry[] {
  const q = termo.trim().toLowerCase();
  if (!q) return SITE_PAGES.slice(0, 12);
  return SITE_PAGES.filter((page) => {
    const label = traduzir(page.labelKey).toLowerCase();
    const section = page.sectionKey ? traduzir(page.sectionKey).toLowerCase() : "";
    const keys = (page.keywords || []).join(" ").toLowerCase();
    const href = page.href.toLowerCase();
    return (
      label.includes(q) ||
      section.includes(q) ||
      keys.includes(q) ||
      href.includes(q)
    );
  });
}
