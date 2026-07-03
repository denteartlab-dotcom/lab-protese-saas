import type { ClienteImportPayload, ResultadoImportacaoClientes } from "@/lib/clientes-import-schema";
import { aguardarJobCliente, ErroJobCliente, type OpcoesPollingJobCliente } from "@/lib/jobs/polling-cliente";

type IniciarImportacaoResposta = {
  jobId?: string;
  error?: string;
};

/** POST /api/clientes/import + polling até concluir (issue 012). */
export async function importarClientesComJob(
  clientes: ClienteImportPayload[],
  opcoes?: OpcoesPollingJobCliente
): Promise<ResultadoImportacaoClientes> {
  let res: Response;
  try {
    res = await fetch("/api/clientes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: opcoes?.signal,
      body: JSON.stringify({ clientes }),
    });
  } catch {
    throw new ErroJobCliente("Erro de conexão ao iniciar a importação.", "rede");
  }

  const data = (await res.json().catch(() => ({}))) as IniciarImportacaoResposta;
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(data.error || "Não foi possível iniciar a importação.", "rede");
  }

  const job = await aguardarJobCliente(data.jobId, opcoes);
  const resultado = job.resultado as ResultadoImportacaoClientes | undefined;
  const ok = resultado?.ok ?? resultado?.importados;
  if (!resultado || typeof ok !== "number") {
    throw new ErroJobCliente("Resposta da importação inválida.", "falhou");
  }

  return {
    ...resultado,
    ok,
    importados: ok,
    erros: resultado.erros ?? [],
  };
}

export { ErroJobCliente };
