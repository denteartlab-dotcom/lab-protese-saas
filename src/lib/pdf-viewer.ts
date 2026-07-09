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
    try {
      w.document.title = "Carregando PDF...";
      w.document.body.innerHTML =
        "<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>Carregando PDF...</div>";
    } catch {
      /* Aba aberta; navegação via location.replace ainda pode funcionar. */
    }
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

/** Nome padrão para salvar PDF de ordem de serviço. */
export function nomeArquivoOsPdf(numeroOs: number) {
  return `OS ${numeroOs}.pdf`;
}

function limparSegmentoNomeArquivo(texto: string) {
  return texto
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

/** Nome sugerido para salvar PDF de fatura (ex.: Fatura 49 - Dr João Silva.pdf). */
export function nomeArquivoFaturaPdf(numeroFatura: number, clienteNome?: string | null) {
  const cliente = limparSegmentoNomeArquivo(clienteNome ?? "");
  if (cliente) return `Fatura ${numeroFatura} - ${cliente}.pdf`;
  return `Fatura ${numeroFatura}.pdf`;
}

/** Blob URL com nome sugerido (melhora título/salvar no visualizador do navegador). */
export function criarUrlPdfNomeada(blob: Blob, nomeArquivo: string) {
  const file = new File([blob], nomeArquivo, {
    type: blob.type || "application/pdf",
  });
  return URL.createObjectURL(file);
}

export function baixarPdfBlob(blob: Blob, nomeArquivo: string) {
  const url = criarUrlPdfNomeada(blob, nomeArquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  agendarRevogarUrl(url);
}

/** Abre o diálogo de impressão do navegador com o mesmo PDF gerado para download. */
export function imprimirPdfBlob(blob: Blob, titulo = "Documento"): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Impressão disponível apenas no navegador."));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    iframe.title = titulo;
    document.body.appendChild(iframe);

    let finalizado = false;
    const limpar = (ok = true) => {
      if (finalizado) return;
      finalizado = true;
      window.setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 500);
      if (ok) resolve();
    };

    const timerSeguranca = window.setTimeout(() => limpar(true), 4_000);

    iframe.onload = () => {
      try {
        const janela = iframe.contentWindow;
        if (!janela) {
          window.clearTimeout(timerSeguranca);
          iframe.remove();
          URL.revokeObjectURL(url);
          reject(new Error("Não foi possível abrir o PDF para impressão."));
          return;
        }
        const aoFechar = () => {
          window.clearTimeout(timerSeguranca);
          limpar(true);
        };
        janela.addEventListener("afterprint", aoFechar, { once: true });
        janela.focus();
        janela.print();
      } catch (err) {
        window.clearTimeout(timerSeguranca);
        iframe.remove();
        URL.revokeObjectURL(url);
        reject(err instanceof Error ? err : new Error("Falha ao imprimir o PDF."));
      }
    };

    iframe.onerror = () => {
      window.clearTimeout(timerSeguranca);
      iframe.remove();
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível carregar o PDF para impressão."));
    };

    iframe.src = url;
  });
}

export async function baixarPdfUrl(url: string, nomeArquivo: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  baixarPdfBlob(blob, nomeArquivo);
}

/** Abre o PDF no visualizador nativo do navegador (uma única nova aba). */
export function visualizarPdfUrl(
  url: string,
  nomeArquivo = "documento.pdf",
  titulo?: string,
  opcoes?: PdfViewerOpcoes
) {
  const revogarAoFechar = opcoes?.revogarAoFechar ?? url.startsWith("blob:");
  const janelaReservada = consumirJanelaReservada(opcoes?.janela);

  if (titulo && janelaReservada && !janelaReservada.closed) {
    try {
      janelaReservada.document.title = titulo;
    } catch {
      /* ignore */
    }
  }

  /** Sempre o blob/URL direto — nunca a rota /relatorio-pdf (perdia o arquivo). */
  const urlVisualizador = srcIframePdfViewer(url);

  if (navegarAbaPdf(janelaReservada, urlVisualizador)) {
    if (revogarAoFechar) agendarRevogarUrl(url);
    return url;
  }

  fecharJanela(janelaReservada);

  if (typeof window === "undefined") return url;

  const nova = window.open(urlVisualizador, "_blank");
  if (!nova) {
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.rel = "noopener";
    link.click();
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
  const url = criarUrlPdfNomeada(blob, nomeArquivo);
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
  nomeArquivo = "documento.html",
  opcoes?: { subtitulo?: string }
) {
  const janela = prepararAbaPdf();
  try {
    await abrirHtmlNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
      janela,
      imprimirAoCarregar: true,
      subtitulo: opcoes?.subtitulo,
    });
  } catch (err) {
    fecharJanela(janela);
    console.error("imprimir HTML", err);
    throw err;
  }
}

/**
 * Gera e abre o PDF direto no navegador (blob URL).
 * Não usa /financeiro/relatorio-pdf — evita “Gerando PDF...” infinito.
 */
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
  await abrirPdfBlobDiretoNaAba(gerar, titulo, nomeArquivo, {
    janela: opcoes?.janela,
  });
}

export async function abrirPdfGerandoNoVisualizadorPagina(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: { janela?: Window | null; subtitulo?: string }
) {
  await abrirPdfBlobDiretoNaAba(gerar, titulo, nomeArquivo, {
    janela: opcoes?.janela,
  });
}

/**
 * Gera o PDF e abre direto na aba (blob URL do navegador).
 * Não depende de sessionStorage/postMessage — caminho confiável para relatórios.
 */
export async function abrirPdfBlobDiretoNaAba(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: { janela?: Window | null }
) {
  const janela = consumirJanelaReservada(opcoes?.janela) ?? prepararAbaPdf();
  try {
    if (janela && !janela.closed) {
      try {
        janela.document.title = `Gerando: ${titulo}`;
        janela.document.body.innerHTML =
          "<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>Gerando PDF...</div>";
      } catch {
        /* ignore */
      }
    }

    const blob = await gerar();
    const url = criarUrlPdfNomeada(blob, nomeArquivo);
    agendarRevogarUrl(url);

    if (janela && !janela.closed) {
      try {
        janela.document.title = titulo;
      } catch {
        /* ignore */
      }
      if (navegarAbaPdf(janela, url)) return;
      fecharJanela(janela);
    }

    const aberta = window.open(url, "_blank");
    if (!aberta) {
      baixarPdfBlob(blob, nomeArquivo);
    }
  } catch (err) {
    fecharJanela(janela);
    console.error("abrir PDF direto", err);
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
    console.error("imprimir PDF", err);
    throw err;
  }
}

/** Abre HTML direto na aba (blob) — sem /relatorio-pdf. */
export async function abrirHtmlNoVisualizadorPagina(
  gerar: () => Promise<string>,
  titulo: string,
  _nomeArquivo = "documento.html",
  opcoes?: { janela?: Window | null; imprimirAoCarregar?: boolean; subtitulo?: string }
) {
  const janela =
    opcoes?.janela && !opcoes.janela.closed ? opcoes.janela : prepararAbaPdf();
  try {
    const html = await gerar();
    const url = abrirHtmlDocumentoNoVisualizador(html, titulo, janela);

    if (opcoes?.imprimirAoCarregar && janela && !janela.closed) {
      window.setTimeout(() => {
        try {
          janela.focus();
          janela.print();
        } catch {
          /* ignore */
        }
      }, 800);
    }

    return url;
  } catch (err) {
    fecharJanela(janela);
    console.error("visualizador HTML", err);
    throw err;
  }
}

export async function abrirHtmlGerandoNoVisualizador(
  gerar: () => Promise<string>,
  titulo?: string,
  nomeArquivo = "documento.html",
  opcoes?: { subtitulo?: string }
) {
  const janela = prepararAbaPdf();
  try {
    await abrirHtmlNoVisualizadorPagina(gerar, titulo ?? "Documento", nomeArquivo, {
      janela,
      subtitulo: opcoes?.subtitulo,
    });
  } catch (err) {
    fecharJanela(janela);
    console.error("visualizador HTML", err);
    throw err;
  }
}
