import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import type { FormatoHtmlPdf } from "@/lib/html-para-pdf";

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

/** Publica HTML no servidor antes de abrir a nova aba (igual fluxo confiável da OS). */
export async function publicarFaturaImpressaoSessao(id: string, payload: FaturaImpressaoSessao) {
  const res = await fetch("/api/fatura-impressao-sessao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, payload }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível preparar a fatura para impressão.");
  }
}

export async function buscarFaturaImpressaoSessao(id: string): Promise<FaturaImpressaoSessao | null> {
  const res = await fetch(`/api/fatura-impressao-sessao?id=${encodeURIComponent(id)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível carregar a fatura.");
  }
  return (await res.json()) as FaturaImpressaoSessao;
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

/** Abre a rota do visualizador de fatura (mesmo padrão da OS). */
export async function abrirFaturaNoVisualizador(
  payload: FaturaImpressaoSessao,
  opcoes?: { janela?: Window | null; imprimir?: boolean }
) {
  const id = criarIdFaturaImpressao();
  await publicarFaturaImpressaoSessao(id, {
    ...payload,
    imprimirAoCarregar: opcoes?.imprimir ?? payload.imprimirAoCarregar,
  });

  const url = montarUrlImpressaoFatura(id, { imprimir: opcoes?.imprimir });
  const janela = opcoes?.janela;
  if (janela && !janela.closed) {
    janela.location.replace(url);
    return;
  }

  const aberta = window.open(url, "_blank");
  if (!aberta) {
    throw new Error("Não foi possível abrir a fatura. Verifique o bloqueio de pop-ups.");
  }
}
