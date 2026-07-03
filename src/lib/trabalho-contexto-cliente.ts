import type { TrabalhoContextoResponse } from "@/lib/trabalho-contexto-types";

export async function fetchTrabalhoContexto(opts?: {
  osId?: string | null;
  clienteId?: string | null;
}): Promise<{ ok: true; dados: TrabalhoContextoResponse } | { ok: false; error: string }> {
  const params = new URLSearchParams();
  if (opts?.osId) params.set("osId", opts.osId);
  if (opts?.clienteId) params.set("clienteId", opts.clienteId);

  const qs = params.toString();
  const url = qs ? `/api/trabalhos/contexto?${qs}` : "/api/trabalhos/contexto";

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as TrabalhoContextoResponse & {
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: json.error || "Não foi possível carregar o contexto da OS." };
    }
    return { ok: true, dados: json };
  } catch {
    return { ok: false, error: "Não foi possível carregar o contexto da OS." };
  }
}
