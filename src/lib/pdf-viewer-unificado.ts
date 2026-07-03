import {
  abrirHtmlNoVisualizadorPagina,
  abrirPdfBlobDiretoNaAba,
  abrirPdfGerandoNoVisualizadorPagina,
} from "@/lib/pdf-viewer";

export type OpcoesVisualizadorUnificado = {
  janela?: Window | null;
  subtitulo?: string;
  origem?: string;
  imprimirAoCarregar?: boolean;
  /** Se true (padrão para relatórios), abre o PDF nativo do navegador sem a rota /relatorio-pdf. */
  direto?: boolean;
};

function subtituloExibicao(opcoes?: OpcoesVisualizadorUnificado) {
  return opcoes?.subtitulo ?? opcoes?.origem;
}

/** Abre PDF gerado no cliente. Por padrão usa blob direto (confiável). */
export async function abrirPdfBlobGerandoNoVisualizadorUnificado(
  gerar: () => Promise<Blob>,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: OpcoesVisualizadorUnificado
) {
  if (opcoes?.direto === false) {
    await abrirPdfGerandoNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
      janela: opcoes?.janela,
      subtitulo: subtituloExibicao(opcoes),
    });
    return;
  }

  await abrirPdfBlobDiretoNaAba(gerar, titulo, nomeArquivo, {
    janela: opcoes?.janela,
  });
}

/** Abre HTML (ex.: fatura) no visualizador único (issue 010). */
export async function abrirHtmlNoVisualizadorUnificado(
  gerar: () => Promise<string>,
  titulo: string,
  nomeArquivo = "documento.html",
  opcoes?: OpcoesVisualizadorUnificado
) {
  await abrirHtmlNoVisualizadorPagina(gerar, titulo, nomeArquivo, {
    janela: opcoes?.janela,
    imprimirAoCarregar: opcoes?.imprimirAoCarregar,
    subtitulo: subtituloExibicao(opcoes),
  });
}

/** Carrega PDF de URL autenticada e abre no visualizador único (issue 015 + 010). */
export async function abrirPdfUrlNoVisualizadorUnificado(
  url: string,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: OpcoesVisualizadorUnificado
) {
  await abrirPdfGerandoNoVisualizadorPagina(
    async () => {
      const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) {
        throw new Error("Não foi possível carregar o PDF.");
      }
      return res.blob();
    },
    titulo,
    nomeArquivo,
    { janela: opcoes?.janela, subtitulo: subtituloExibicao(opcoes) }
  );
}
