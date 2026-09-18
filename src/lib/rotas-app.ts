/** Primeiro segmento após /app que não é slug de empresa (rotas legadas). */
export const ROTAS_APP_SEM_SLUG = new Set([
  "alterar-senha",
  "cadastros",
  "clientes",
  "configuracoes",
  "disparos-whatsapp",
  "financeiro",
  "liberar-espaco",
  "lista-imagens",
  "orcamentos",
  "pacientes",
  "producao",
  "produtos",
  "relatorios",
  "trabalhos",
]);

export function segmentoEhRotaAppLegada(segmento: string | undefined): boolean {
  if (!segmento) return false;
  return ROTAS_APP_SEM_SLUG.has(segmento);
}

/** /app/denteart/clientes → { slug: "denteart", restante: "/clientes" } */
export function analisarCaminhoApp(pathname: string): {
  slug: string | null;
  restante: string;
  legado: boolean;
} {
  const partes = pathname.split("/").filter(Boolean);
  if (partes[0] !== "app") {
    return { slug: null, restante: pathname, legado: false };
  }

  const segundo = partes[1];
  if (!segundo) {
    return { slug: null, restante: "", legado: true };
  }

  if (segmentoEhRotaAppLegada(segundo)) {
    const restante = partes.length > 1 ? `/${partes.slice(1).join("/")}` : "";
    return { slug: null, restante, legado: true };
  }

  const restante = partes.length > 2 ? `/${partes.slice(2).join("/")}` : "";
  return { slug: segundo, restante, legado: false };
}

export function montarCaminhoAppComSlug(slug: string, restante = ""): string {
  const sufixo = restante.startsWith("/") ? restante : restante ? `/${restante}` : "";
  if (!sufixo || sufixo === "/") return `/app/${slug}`;
  return `/app/${slug}${sufixo}`;
}

export function caminhoInternoApp(restante: string): string {
  if (!restante || restante === "/") return "/app";
  return `/app${restante.startsWith("/") ? restante : `/${restante}`}`;
}

/** Início do app: /app ou /app/{slug-da-empresa} */
export function ehPaginaInicioApp(pathname: string): boolean {
  const normalizado = pathname.replace(/\/+$/, "") || "/";
  if (normalizado === "/app") return true;
  const { slug, restante } = analisarCaminhoApp(normalizado);
  if (!slug) return false;
  return !restante || restante === "/";
}

/** Sufixo após o slug da empresa (ex.: /financeiro, /producao/os). */
export function restanteCaminhoMenuApp(pathname: string): string {
  const normalizado = pathname.replace(/\/+$/, "") || "/";
  const { restante, legado } = analisarCaminhoApp(normalizado);
  if (legado) {
    const partes = normalizado.split("/").filter(Boolean);
    if (partes[0] === "app" && partes.length > 1) {
      return `/${partes.slice(1).join("/")}`;
    }
    return restante || "/";
  }
  return restante || "/";
}

/** Verifica se o menu principal deve ficar ativo (compatível com /app/{slug}/...). */
export function menuAppSecaoAtiva(pathname: string, prefixos: string | string[]): boolean {
  const lista = Array.isArray(prefixos) ? prefixos : [prefixos];
  const restante = restanteCaminhoMenuApp(pathname);

  return lista.some((prefixo) => {
    const norm = prefixo.startsWith("/") ? prefixo : `/${prefixo}`;
    return restante === norm || restante.startsWith(`${norm}/`);
  });
}

/**
 * Visão ativa do Financeiro (espelha o roteamento em financeiro/page.tsx).
 * Usado para destacar só o subitem correto quando todos apontam para /app/financeiro?...
 */
export function financeiroVisaoAtiva(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): "receita" | "boletos" | "despesa" | "plano-de-contas" | "conta-bancaria" {
  const aba = searchParams.get("aba");
  const tipo = searchParams.get("tipo");
  const acao = searchParams.get("acao");

  if (aba === "plano-de-contas") return "plano-de-contas";
  if (aba === "conta-bancaria" || aba === "conta-digital") return "conta-bancaria";
  if (aba === "boletos") return "boletos";
  if (
    aba === "pagar" ||
    tipo === "despesa" ||
    tipo === "vencidas" ||
    acao === "pagar"
  ) {
    return "despesa";
  }
  return "receita";
}

function financeiroHrefVisao(expected: URLSearchParams): string | null {
  if (expected.get("aba") === "plano-de-contas") return "plano-de-contas";
  if (expected.get("aba") === "conta-bancaria") return "conta-bancaria";
  if (expected.get("aba") === "boletos") return "boletos";
  if (expected.get("tipo") === "despesa") return "despesa";
  if (expected.get("tipo") === "receita") return "receita";
  return null;
}

/**
 * Item de menu ativo considerando pathname + query (?tipo=, ?aba=).
 * Sem query, mantém o comportamento de menuAppSecaoAtiva / início.
 */
export function menuAppHrefAtivo(
  pathname: string,
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  href: string
): boolean {
  const [pathPart, queryPart = ""] = href.split("?");
  const base = pathPart || href;

  if (base === "/app") return ehPaginaInicioApp(pathname);

  const sufixo = base.replace(/^\/app/, "") || "/";
  if (!menuAppSecaoAtiva(pathname, sufixo)) return false;

  if (!queryPart) return true;

  const expected = new URLSearchParams(queryPart);

  if (menuAppSecaoAtiva(pathname, "/financeiro")) {
    const visaoHref = financeiroHrefVisao(expected);
    if (visaoHref) {
      return financeiroVisaoAtiva(searchParams) === visaoHref;
    }
  }

  for (const [key, value] of expected.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

export function normalizarSlugEmpresa(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
