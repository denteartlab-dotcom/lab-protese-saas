export type BatchStatusTrabalhosResposta = {
  ok: boolean;
  status: string;
  atualizados: number;
  ignorados: string[];
  trabalhoIds: string[];
  numerosOs: number[];
};

export async function atualizarStatusTrabalhosLote(
  ids: string[],
  status: string
): Promise<BatchStatusTrabalhosResposta> {
  const res = await fetch("/api/trabalhos/batch-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ ids, status }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Não foi possível atualizar as OS em lote."
    );
  }

  return body as BatchStatusTrabalhosResposta;
}
