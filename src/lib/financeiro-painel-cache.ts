import type {
  AbaPainelFinanceiro,
  PainelFinanceiroAba,
} from "@/lib/financeiro-painel-server";

const CACHE_TTL_MS = 30_000;
const cachePainel = new Map<string, { expira: number; dados: PainelFinanceiroAba }>();

function chaveCache(empresaId: string, aba: AbaPainelFinanceiro) {
  return `${empresaId}:${aba}`;
}

export function lerCachePainelFinanceiro(
  empresaId: string,
  aba: AbaPainelFinanceiro
): PainelFinanceiroAba | null {
  const entrada = cachePainel.get(chaveCache(empresaId, aba));
  if (!entrada || entrada.expira <= Date.now()) {
    cachePainel.delete(chaveCache(empresaId, aba));
    return null;
  }
  return entrada.dados;
}

export function gravarCachePainelFinanceiro(
  empresaId: string,
  aba: AbaPainelFinanceiro,
  dados: PainelFinanceiroAba
) {
  cachePainel.set(chaveCache(empresaId, aba), {
    expira: Date.now() + CACHE_TTL_MS,
    dados,
  });
}

export function invalidarCachePainelFinanceiro(
  empresaId: string,
  aba?: AbaPainelFinanceiro
) {
  if (aba) {
    cachePainel.delete(chaveCache(empresaId, aba));
    return;
  }
  for (const key of cachePainel.keys()) {
    if (key.startsWith(`${empresaId}:`)) cachePainel.delete(key);
  }
}
