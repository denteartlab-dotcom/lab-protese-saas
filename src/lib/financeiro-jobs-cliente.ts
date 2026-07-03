import {
  aguardarJobCliente,
  ErroJobCliente,
  type OpcoesPollingJobCliente,
} from "@/lib/jobs/polling-cliente";

const TIMEOUT_EMISSAO_MS = 90_000;

export type ResultadoEmitirNfseJob = {
  nfseId: string;
  status: string;
  pdfUrl?: string | null;
  mensagemErro?: string | null;
};

export type ResultadoEmitirBoletoJob = {
  cobrancaId?: string;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
  linhaDigitavel?: string | null;
  statusAsaas?: string;
};

export type ResultadoAplicarOrcamentoJob = {
  aplicado: boolean;
  itensAtualizados?: number;
  aviso?: string | null;
};

async function iniciarJobPost(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(
      data.error || "Não foi possível iniciar o processamento.",
      "rede"
    );
  }
  return String(data.jobId);
}

/** Emite NFS-e em background e aguarda a conclusão (issue 030). */
export async function emitirNfseComJob(
  payload: { clienteId: string; valor: number; descricao?: string; lancamentoId?: string },
  opcoes?: OpcoesPollingJobCliente
): Promise<ResultadoEmitirNfseJob> {
  const jobId = await iniciarJobPost("/api/nfse/emitir/async", payload);
  const job = await aguardarJobCliente(jobId, {
    ...opcoes,
    timeoutMs: opcoes?.timeoutMs ?? TIMEOUT_EMISSAO_MS,
  });
  return (job.resultado ?? { status: "emitido", nfseId: "" }) as ResultadoEmitirNfseJob;
}

/** Emite boleto Asaas em background e aguarda a cobrança (issue 030). */
export async function emitirBoletoAsaasComJob(
  lancamentoId: string,
  opcoes?: OpcoesPollingJobCliente
): Promise<ResultadoEmitirBoletoJob> {
  const jobId = await iniciarJobPost(
    `/api/financeiro/${encodeURIComponent(lancamentoId)}/emitir-boleto/async`
  );
  const job = await aguardarJobCliente(jobId, {
    ...opcoes,
    timeoutMs: opcoes?.timeoutMs ?? TIMEOUT_EMISSAO_MS,
  });
  return (job.resultado ?? {}) as ResultadoEmitirBoletoJob;
}

export { ErroJobCliente };
