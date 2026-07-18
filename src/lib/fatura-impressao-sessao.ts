import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import type { ModeloFaturaId } from "@/lib/configuracoes-faturas";
import type { DadosFaturaImpressao } from "@/lib/fatura-impressao-html";
import type { FormatoHtmlPdf } from "@/lib/html-para-pdf";

export type FaturaImpressaoSessao = {
  html: string;
  numeroFatura: number;
  clienteNome: string;
  subtitulo: string;
  formato: FormatoHtmlPdf;
  imprimirAoCarregar?: boolean;
  /** Dados estruturados para PDF nativo (mesma base da OS). */
  dados?: DadosFaturaImpressao;
  modelo?: ModeloFaturaId;
};

export function criarIdFaturaImpressao() {
  return crypto.randomUUID();
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

async function blobPdfParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== "string") {
        reject(new Error("Falha ao ler o PDF."));
        return;
      }
      const base64 = data.split(",")[1];
      if (!base64) {
        reject(new Error("Falha ao converter o PDF."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o PDF."));
    reader.readAsDataURL(blob);
  });
}

/** Publica o PDF gerado no servidor para exibir com nome legível no visualizador. */
export async function publicarPdfFaturaImpressao(
  sessaoId: string,
  blob: Blob,
  nomeArquivo: string
) {
  const pdfBase64 = await blobPdfParaBase64(blob);
  const res = await fetch("/api/fatura-impressao-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id: sessaoId, pdfBase64, nomeArquivo }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível publicar o PDF da fatura.");
  }
}

export function montarUrlPdfFaturaServidor(sessaoId: string, nomeArquivo: string) {
  const segmento = encodeURIComponent(nomeArquivo);
  return `/api/fatura-impressao-pdf/${segmento}?id=${encodeURIComponent(sessaoId)}`;
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
