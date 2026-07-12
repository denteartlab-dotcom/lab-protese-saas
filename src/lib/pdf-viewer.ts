import { srcIframePdfViewer } from "@/lib/pdf-viewer-iframe";
import { pl, localeImpressaoAtual } from "@/lib/i18n/print-i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";

export type PdfViewerOpcoes = {
  revogarAoFechar?: boolean;
  janela?: Window | null;
};

let janelaPdfReservada: Window | null = null;

function htmlLangImpressao() {
  return localeDataIntl(localeImpressaoAtual());
}

function textoCarregandoPdf() {
  return pl("print.comum.carregandoPdf");
}

function textoGerandoPdf() {
  return pl("print.comum.gerandoPdf");
}

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
      const carregando = textoCarregandoPdf();
      w.document.title = carregando;
      w.document.body.innerHTML =
        `<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>${carregando}</div>`;
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

function escapeHtmlTexto(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function abrirPdfNaJanelaComTitulo(janela: Window, pdfUrl: string, titulo: string) {
  const tituloSafe = escapeHtmlTexto(titulo);
  const urlSafe = pdfUrl.replace(/"/g, "&quot;");
  janela.document.open();
  janela.document.write(`<!DOCTYPE html>
<html lang="${htmlLangImpressao()}">
<head>
<meta charset="utf-8">
<title>${tituloSafe}</title>
<style>
html,body{margin:0;height:100%;background:#525659}
iframe{display:block;width:100%;height:100%;border:0}
</style>
</head>
<body>
<iframe src="${urlSafe}" title="${tituloSafe}"></iframe>
</body>
</html>`);
  janela.document.close();
}

function agendarRevogarUrl(url: string) {
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** Nome padrão para salvar PDF de ordem de serviço. */
export function nomeArquivoOsPdf(numeroOs: number) {
  return pl("print.comum.arquivoOs", { n: numeroOs });
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
  if (cliente) {
    return pl("print.comum.arquivoFaturaCliente", { n: numeroFatura, cliente });
  }
  return pl("print.comum.arquivoFatura", { n: numeroFatura });
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
export function imprimirPdfBlob(blob: Blob, titulo?: string): Promise<void> {
  const tituloDoc = titulo ?? pl("print.comum.documento");
  if (typeof window === "undefined") {
    return Promise.reject(new Error(pl("print.comum.impressaoSomenteNavegador")));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    iframe.title = tituloDoc;
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
          reject(new Error(pl("print.comum.erroAbrirPdfImpressao")));
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
        reject(err instanceof Error ? err : new Error(pl("print.comum.erroImprimirPdf")));
      }
    };

    iframe.onerror = () => {
      window.clearTimeout(timerSeguranca);
      iframe.remove();
      URL.revokeObjectURL(url);
      reject(new Error(pl("print.comum.erroCarregarPdfImpressao")));
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
  nomeArquivo = pl("print.comum.documentoPdf"),
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
  nomeArquivo = pl("print.comum.documentoPdf"),
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
  titulo?: string,
  janela?: Window | null
) {
  const tituloDoc = titulo ?? pl("print.comum.documento");
  const alvo = consumirJanelaReservada(janela);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  if (alvo && !alvo.closed) {
    try {
      alvo.document.title = tituloDoc;
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
    throw new Error(pl("print.comum.erroAbrirPopups"));
  }
  try {
    nova.document.title = tituloDoc;
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
  titulo?: string,
  nomeArquivo = pl("print.comum.documentoHtml"),
  opcoes?: { subtitulo?: string }
) {
  const tituloDoc = titulo ?? pl("print.comum.documento");
  const janela = prepararAbaPdf();
  try {
    await abrirHtmlNoVisualizadorPagina(gerar, tituloDoc, nomeArquivo, {
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
  nomeArquivo = pl("print.comum.documentoPdf"),
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
  nomeArquivo = pl("print.comum.documentoPdf"),
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
  nomeArquivo = pl("print.comum.documentoPdf"),
  opcoes?: { janela?: Window | null }
) {
  const janela = consumirJanelaReservada(opcoes?.janela) ?? prepararAbaPdf();
  try {
    if (janela && !janela.closed) {
      try {
        janela.document.title = pl("print.comum.gerandoTitulo", { titulo });
        const gerando = textoGerandoPdf();
        janela.document.body.innerHTML =
          `<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>${gerando}</div>`;
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
      // Navegação direta preserva o nome do File no diálogo Salvar do Chrome.
      if (navegarAbaPdf(janela, url)) {
        return;
      }
      abrirPdfNaJanelaComTitulo(janela, url, titulo);
      return;
    }

    const aberta = window.open("about:blank", "_blank");
    if (aberta) {
      try {
        aberta.document.title = titulo;
      } catch {
        /* ignore */
      }
      if (navegarAbaPdf(aberta, url)) {
        return;
      }
      abrirPdfNaJanelaComTitulo(aberta, url, titulo);
    } else {
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
  nomeArquivo = pl("print.comum.documentoPdf"),
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
  _nomeArquivo = pl("print.comum.documentoHtml"),
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
  nomeArquivo = pl("print.comum.documentoHtml"),
  opcoes?: { subtitulo?: string }
) {
  const janela = prepararAbaPdf();
  try {
    await abrirHtmlNoVisualizadorPagina(gerar, titulo ?? pl("print.comum.documento"), nomeArquivo, {
      janela,
      subtitulo: opcoes?.subtitulo,
    });
  } catch (err) {
    fecharJanela(janela);
    console.error("visualizador HTML", err);
    throw err;
  }
}
