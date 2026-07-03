import type { AbaPainelFinanceiro, PainelFinanceiroAba } from "@/lib/financeiro-painel-types";

export async function fetchPainelFinanceiro<T extends PainelFinanceiroAba>(
  aba: AbaPainelFinanceiro,
  opts?: { refresh?: boolean }
): Promise<{ ok: true; dados: T } | { ok: false; error: string }> {
  const params = new URLSearchParams({ aba });
  if (opts?.refresh) params.set("refresh", "1");

  try {
    const res = await fetch(`/api/financeiro/painel?${params}`, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error || "Não foi possível carregar o painel financeiro." };
    }
    return { ok: true, dados: json as T };
  } catch {
    return { ok: false, error: "Não foi possível carregar o painel financeiro." };
  }
}
