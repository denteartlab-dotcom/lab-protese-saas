import {
  abrirHtmlNoVisualizadorPagina,
  abrirPdfBlobDiretoNaAba,
} from "@/lib/pdf-viewer";

export type OpcoesVisualizadorUnificado = {
  janela?: Window | null;
  subtitulo?: string;
  origem?: string;
  imprimirAoCarregar?: boolean;
};

/** Abre PDF gerado no cliente direto no navegador (blob URL). */
export async function abrirPdfBlobGerandoNoVisualizadorUnificado(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: OpcoesVisualizadorUnificado
) {
  await abrirPdfBlobDiretoNaAba(gerar, titulo, nomeArquivo, {
    janela: opcoes?.janela,
  });
}

/** Abre HTML (ex.: fatura) direto na aba. */
export async function abrirHtmlNoVisualizadorUnificado(
  gerar: () => Promise<string>,
  titulo: string,
  nomeArquivo = "documento.html",
  opcoes?: OpcoesVisualizadorUnificado
) {
  await abrirHtmlNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
    janela: opcoes?.janela,
    imprimirAoCarregar: opcoes?.imprimirAoCarregar,
    subtitulo: opcoes?.subtitulo ?? opcoes?.origem,
  });
}
