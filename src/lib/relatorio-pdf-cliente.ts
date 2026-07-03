import type { ResultadoRelatorioPdfJob, TipoRelatorioPdf } from "@/lib/relatorio-pdf-schema";
import { aguardarJobCliente, ErroJobCliente, type OpcoesPollingJobCliente } from "@/lib/jobs/polling-cliente";
import { abrirPdfViewerMensagem } from "@/lib/pdf-viewer-aba";
import { abrirPdfUrlNoVisualizadorUnificado } from "@/lib/pdf-viewer-unificado";

type IniciarRelatorioPdfResposta = {
  jobId?: string;
  error?: string;
};

function resultadoRelatorioPdfValido(
  valor: unknown
): valor is ResultadoRelatorioPdfJob {
  if (!valor || typeof valor !== "object") return false;
  const r = valor as ResultadoRelatorioPdfJob;
  if ("semDados" in r && r.semDados) {
    return typeof r.titulo === "string" && typeof r.mensagem === "string";
  }
  return (
    r.semDados === false &&
    typeof r.pdfId === "string" &&
    typeof r.url === "string"
  );
}

/** POST /api/relatorios/[tipo]/pdf + polling até concluir (issue 015). */
export async function gerarRelatorioPdfComJob(
  tipo: TipoRelatorioPdf,
  params: unknown,
  opcoes?: OpcoesPollingJobCliente
): Promise<ResultadoRelatorioPdfJob> {
  let res: Response;
  try {
    res = await fetch(`/api/relatorios/${tipo}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: opcoes?.signal,
      body: JSON.stringify(params),
    });
  } catch {
    throw new ErroJobCliente("Erro de conexão ao iniciar a geração do PDF.", "rede");
  }

  const data = (await res.json().catch(() => ({}))) as IniciarRelatorioPdfResposta;
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(data.error || "Não foi possível iniciar a geração do PDF.", "rede");
  }

  const job = await aguardarJobCliente(data.jobId, opcoes);
  const resultado = job.resultado;
  if (!resultadoRelatorioPdfValido(resultado)) {
    throw new ErroJobCliente("Resposta do relatório PDF inválida.", "falhou");
  }

  return resultado;
}

/** Abre PDF gerado pelo job no visualizador do app. */
export async function abrirRelatorioPdfJob(
  resultado: ResultadoRelatorioPdfJob,
  opcoes?: { janela?: Window | null }
) {
  if (resultado.semDados) {
    await abrirPdfViewerMensagem(resultado.titulo, resultado.mensagem, {
      janela: opcoes?.janela,
      subtitulo: "Relatório sem dados",
      vazio: true,
    });
    return;
  }

  await abrirPdfUrlNoVisualizadorUnificado(
    resultado.url,
    resultado.titulo,
    resultado.nomeArquivo,
    { janela: opcoes?.janela, origem: "Relatórios" }
  );
}

export { ErroJobCliente };
