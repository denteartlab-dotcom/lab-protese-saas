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

export function salvarFaturaImpressaoSessao(id: string, payload: FaturaImpressaoSessao) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${PREFIX}${id}`, JSON.stringify(payload));
}

export function lerFaturaImpressaoSessao(id: string): FaturaImpressaoSessao | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${PREFIX}${id}`);
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
