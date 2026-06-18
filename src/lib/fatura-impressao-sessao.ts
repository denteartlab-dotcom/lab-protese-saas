import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import type { FormatoHtmlPdf } from "@/lib/html-para-pdf";

const PREFIX = "labProteseFaturaImpressao:";

export type FaturaImpressaoSessao = {
  html: string;
  numeroFatura: number;
  clienteNome: string;
  subtitulo: string;
  formato: FormatoHtmlPdf;
  imprimirAoCarregar?: boolean;
};

export function criarIdFaturaImpressao() {
  return `fatura-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function chaveStorage(id: string) {
  return `${PREFIX}${id}`;
}

/** localStorage é compartilhado entre abas (sessionStorage não funciona com noopener). */
export function salvarFaturaImpressaoSessao(id: string, payload: FaturaImpressaoSessao) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(payload);
  localStorage.setItem(chaveStorage(id), raw);
  // Compatibilidade com abas antigas que ainda liam sessionStorage
  try {
    sessionStorage.setItem(chaveStorage(id), raw);
  } catch {
    /* quota ou modo privado */
  }
}

export function lerFaturaImpressaoSessao(id: string): FaturaImpressaoSessao | null {
  if (typeof window === "undefined") return null;
  const key = chaveStorage(id);
  const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FaturaImpressaoSessao;
  } catch {
    return null;
  }
}

export function montarUrlImpressaoFatura(id: string, opcoes?: { imprimir?: boolean }) {
  const params = new URLSearchParams({ id });
  if (opcoes?.imprimir) params.set("imprimir", "1");
  const query = `?${params.toString()}`;
  const path = `/financeiro/fatura/imprimir${query}`;

  if (typeof window === "undefined") {
    return `/app${path}`;
  }

  const { slug, legado } = analisarCaminhoApp(window.location.pathname);
  if (!legado && slug) {
    return montarCaminhoAppComSlug(slug, path);
  }
  return `/app${path}`;
}
