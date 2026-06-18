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

/** Abre HTML em nova aba — mesma renderização do preview em Configurações (sem rasterizar). */
export function abrirHtmlDocumentoNoVisualizador(
  html: string,
  titulo = "Documento",
  janela?: Window | null
) {
  const alvo = consumirJanelaReservada(janela);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  if (alvo && !alvo.closed) {
    try {
      alvo.document.title = titulo;
    } catch {
      /* ignore */
    }
    if (navegarAbaPdf(alvo, url)) {
      agendarRevogarUrl(url);
      return url;
    }
    fecharJanela(alvo);
  }

  if (typeof window === "undefined") return url;

  const nova = window.open(url, "_blank");
  if (!nova) {
    URL.revokeObjectURL(url);
    throw new Error("Não foi possível abrir a fatura. Verifique o bloqueio de pop-ups.");
  }
  try {
    nova.document.title = titulo;
  } catch {
    /* ignore */
  }
  agendarRevogarUrl(url);
  return url;
}

export async function abrirHtmlGerando(gerar: () => Promise<string>, titulo?: string) {
  const janela = prepararAbaPdf();
  try {
    const html = await gerar();
    return abrirHtmlDocumentoNoVisualizador(html, titulo, janela);
  } catch (err) {
    fecharJanela(janela);
    console.error("gerar HTML", err);
    throw err;
  }
}

/** Abre o HTML no visualizador do app e dispara impressão ao carregar. */
export async function abrirHtmlParaImpressao(
  gerar: () => Promise<string>,
  titulo = "Documento",
  nomeArquivo = "documento.html"
) {
  const janela = prepararAbaPdf();
  try {
    await abrirHtmlNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
      janela,
      imprimirAoCarregar: true,
    });
  } catch (err) {
    fecharJanela(janela);
    console.error("imprimir HTML", err);
    throw err;
  }
}

/** Abre PDF no visualizador do app (/app/financeiro/relatorio-pdf) — mesmo estilo da OS. */
export async function abrirPdfNoVisualizadorPagina(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: {
    janela?: Window | null;
    imprimirAoCarregar?: boolean;
    subtitulo?: string;
  }
) {
  const {
    criarIdPdfViewer,
    urlPdfViewerPagina,
    publicarPdfNaAba,
    salvarPdfViewerSession,
    salvarPdfViewerSessionNaJanela,
    enviarPdfViewerParaJanela,
    registrarRepassadorPdfViewerOpener,
    marcarPdfViewerErro,
  } = await import("@/lib/pdf-viewer-aba");

  registrarRepassadorPdfViewerOpener();

  const id = criarIdPdfViewer();
  const janela = consumirJanelaReservada(opcoes?.janela);

  salvarPdfViewerSession(id, {
    status: "loading",
    titulo,
    subtitulo: opcoes?.subtitulo,
    nomeArquivo,
  });

  let payloadPronto: Awaited<ReturnType<typeof publicarPdfNaAba>> | null = null;
  let blobGerado: Blob | null = null;
  try {
    blobGerado = await gerar();
    payloadPronto = await publicarPdfNaAba(id, blobGerado, titulo, nomeArquivo, {
      imprimirAoCarregar: opcoes?.imprimirAoCarregar,
      subtitulo: opcoes?.subtitulo,
    });
    if (janela && !janela.closed) {
      salvarPdfViewerSessionNaJanela(janela, id, payloadPronto);
    }
  } catch (err) {
    marcarPdfViewerErro(id, "Não foi possível carregar o documento.", titulo);
    fecharJanela(janela);
    console.error("visualizador PDF", err);
    throw err;
  }

  const url = urlPdfViewerPagina(id);

  if (janela && !janela.closed) {
    try {
      janela.document.title = titulo;
    } catch {
      /* ignore */
    }
    if (!navegarAbaPdf(janela, url)) {
      fecharJanela(janela);
      const nova = window.open(url, "_blank");
      if (!nova) {
        if (blobGerado) abrirPdfNoVisualizador(blobGerado, nomeArquivo, titulo, janela);
      } else if (payloadPronto) {
        enviarPdfViewerParaJanela(nova, id, payloadPronto);
      }
    } else if (payloadPronto) {
      enviarPdfViewerParaJanela(janela, id, payloadPronto);
    }
    return;
  }

  if (typeof window === "undefined") return;

  const nova = window.open(url, "_blank");
  if (!nova) {
    if (blobGerado) abrirPdfNoVisualizador(blobGerado, nomeArquivo, titulo);
  } else if (payloadPronto) {
    enviarPdfViewerParaJanela(nova, id, payloadPronto);
  }
}

export async function abrirPdfGerandoNoVisualizadorPagina(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: { subtitulo?: string }
) {
  const janela = prepararAbaPdf();
  try {
    await abrirPdfNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
      janela,
      subtitulo: opcoes?.subtitulo,
    });
  } catch (err) {
    fecharJanela(janela);
    console.error("visualizador PDF", err);
    throw err;
  }
}

export async function abrirPdfParaImpressaoNoVisualizador(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: { subtitulo?: string }
) {
  const janela = prepararAbaPdf();
  try {
    await abrirPdfNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
      janela,
      imprimirAoCarregar: true,
      subtitulo: opcoes?.subtitulo,
    });
  } catch (err) {
    fecharJanela(janela);
    console.error("imprimir PDF", err);
    throw err;
  }
}

/** Abre HTML no visualizador do app (/app/financeiro/relatorio-pdf) — layout idêntico ao preview. */
export async function abrirHtmlNoVisualizadorPagina(
  gerar: () => Promise<string>,
  titulo: string,
  nomeArquivo = "documento.html",
  opcoes?: { janela?: Window | null; imprimirAoCarregar?: boolean }
) {
  const {
    criarIdPdfViewer,
    urlPdfViewerPagina,
    publicarHtmlNaAba,
    salvarPdfViewerSession,
    salvarPdfViewerSessionNaJanela,
    enviarPdfViewerParaJanela,
    registrarRepassadorPdfViewerOpener,
    marcarPdfViewerErro,
  } = await import("@/lib/pdf-viewer-aba");

  registrarRepassadorPdfViewerOpener();

  const id = criarIdPdfViewer();
  const janela = consumirJanelaReservada(opcoes?.janela);

  salvarPdfViewerSession(id, { status: "loading", titulo, nomeArquivo });

  let html = "";
  let payloadPronto: Awaited<ReturnType<typeof publicarHtmlNaAba>> | null = null;
  try {
    html = await gerar();
    payloadPronto = await publicarHtmlNaAba(id, html, titulo, nomeArquivo, {
      imprimirAoCarregar: opcoes?.imprimirAoCarregar,
    });
    if (janela && !janela.closed) {
      salvarPdfViewerSessionNaJanela(janela, id, payloadPronto);
    }
  } catch (err) {
    marcarPdfViewerErro(id, "Não foi possível carregar o documento.", titulo);
    fecharJanela(janela);
    console.error("visualizador HTML", err);
    if (html) {
      abrirHtmlDocumentoNoVisualizador(html, titulo, janela);
      return;
    }
    throw err;
  }

  const url = urlPdfViewerPagina(id);

  if (janela && !janela.closed) {
    try {
      janela.document.title = titulo;
    } catch {
      /* ignore */
    }
    if (!navegarAbaPdf(janela, url)) {
      fecharJanela(janela);
      const nova = window.open(url, "_blank");
      if (!nova) {
        abrirHtmlDocumentoNoVisualizador(html, titulo);
      } else if (payloadPronto) {
        enviarPdfViewerParaJanela(nova, id, payloadPronto);
      }
    } else if (payloadPronto) {
      enviarPdfViewerParaJanela(janela, id, payloadPronto);
    }
    return;
  }

  if (typeof window === "undefined") return;

  const nova = window.open(url, "_blank");
  if (!nova) {
    abrirHtmlDocumentoNoVisualizador(html, titulo);
  } else if (payloadPronto) {
    enviarPdfViewerParaJanela(nova, id, payloadPronto);
  }
}

export async function abrirHtmlGerandoNoVisualizador(
  gerar: () => Promise<string>,
  titulo?: string,
  nomeArquivo = "documento.html"
) {
  const janela = prepararAbaPdf();
  try {
    await abrirHtmlNoVisualizadorPagina(gerar, titulo ?? "Documento", nomeArquivo, { janela });
  } catch (err) {
    fecharJanela(janela);
    console.error("visualizador HTML", err);
    throw err;
  }
}
