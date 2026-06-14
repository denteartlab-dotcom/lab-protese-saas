import { srcIframePdfViewer } from "@/lib/pdf-viewer-iframe";

export type PdfViewerOpcoes = {
  revogarAoFechar?: boolean;
  janela?: Window | null;
};

let janelaPdfReservada: Window | null = null;

/**
 * Reserva uma aba no clique do usuário (antes de gerar o PDF).
 * Sem `noopener`: o opener precisa poder definir `location` na aba reservada.
 */
export function prepararAbaPdf(): Window | null {
  janelaPdfReservada = criarAbaPdfCarregando();
  return janelaPdfReservada;
}

function criarAbaPdfCarregando(): Window | null {
  if (typeof window === "undefined") return null;
  try {
    const w = window.open("about:blank", "_blank");
    if (!w) return null;
    w.document.title = "Carregando PDF...";
    w.document.body.innerHTML =
      "<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>Carregando PDF...</div>";
    return w;
  } catch {
    return null;
  }
}

function consumirJanelaReservada(janela?: Window | null): Window | null {
  const alvo = janela ?? janelaPdfReservada;
  janelaPdfReservada = null;
  return alvo && !alvo.closed ? alvo : null;
}

function fecharJanela(janela: Window | null | undefined) {
  if (!janela || janela.closed) return;
  try {
    janela.close();
  } catch {
    /* ignore */
  }
}

function navegarAbaPdf(janela: Window | null, url: string): boolean {
  if (!janela || janela.closed) return false;
  try {
    janela.location.replace(url);
    return true;
  } catch {
    return false;
  }
}

function agendarRevogarUrl(url: string) {
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function baixarPdfUrl(url: string, nomeArquivo: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Abre o PDF no visualizador nativo do navegador (uma única nova aba). */
export function visualizarPdfUrl(
  url: string,
  nomeArquivo = "documento.pdf",
  titulo?: string,
  opcoes?: PdfViewerOpcoes
) {
  void nomeArquivo;

  const revogarAoFechar = opcoes?.revogarAoFechar ?? url.startsWith("blob:");
  const janelaReservada = consumirJanelaReservada(opcoes?.janela);

  if (titulo && janelaReservada && !janelaReservada.closed) {
    try {
      janelaReservada.document.title = titulo;
    } catch {
      /* ignore */
    }
  }

  const urlVisualizador = srcIframePdfViewer(url);

  if (navegarAbaPdf(janelaReservada, urlVisualizador)) {
    if (revogarAoFechar) agendarRevogarUrl(url);
    return url;
  }

  fecharJanela(janelaReservada);

  if (typeof window === "undefined") return url;

  const nova = window.open(urlVisualizador, "_blank");
  if (!nova) {
    baixarPdfUrl(url, nomeArquivo);
    if (revogarAoFechar) agendarRevogarUrl(url);
    return url;
  }

  if (revogarAoFechar) agendarRevogarUrl(url);
  return url;
}

export function abrirPdfNoVisualizador(
  blob: Blob,
  nomeArquivo = "documento.pdf",
  titulo?: string,
  janela?: Window | null
) {
  const url = URL.createObjectURL(blob);
  visualizarPdfUrl(url, nomeArquivo, titulo, {
    revogarAoFechar: true,
    janela,
  });
  return url;
}

export async function abrirPdfGerando(
  gerar: () => Promise<Blob>,
  nomeArquivo?: string,
  titulo?: string
) {
  const janela = prepararAbaPdf();
  try {
    const blob = await gerar();
    return abrirPdfNoVisualizador(blob, nomeArquivo, titulo, janela);
  } catch (err) {
    fecharJanela(janela);
    console.error("gerar PDF", err);
    throw err;
  }
}
