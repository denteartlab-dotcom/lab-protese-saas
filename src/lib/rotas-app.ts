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

export function normalizarSlugEmpresa(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
