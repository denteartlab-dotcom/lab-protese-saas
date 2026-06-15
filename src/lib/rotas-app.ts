/** Primeiro segmento após /app que não é slug de empresa (rotas legadas). */
export const ROTAS_APP_SEM_SLUG = new Set([
  "alterar-senha",
  "cadastros",
  "clientes",
  "configuracoes",
  "financeiro",
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

export function normalizarSlugEmpresa(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
