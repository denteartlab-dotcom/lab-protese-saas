/**
 * Métricas leves de duração das rotas /api/* (issue 001).
 * Em desenvolvimento alimenta log + endpoint /api/dev/metricas-api.
 * Desative com API_METRICAS=0.
 */

export type MetricaApi = {
  rota: string;
  metodo: string;
  duracaoMs: number;
  status: number;
  empresaId?: string;
  em: number;
};

type AcumuladoRota = {
  rota: string;
  metodo: string;
  chamadas: number;
  duracaoTotalMs: number;
  duracaoMaxMs: number;
  erros: number;
  ultimoStatus: number;
  ultimaEm: number;
};

const MAX_REGISTROS = 500;
const buffer: MetricaApi[] = [];
const acumulado = new Map<string, AcumuladoRota>();

function chave(rota: string, metodo: string) {
  return `${metodo} ${rota}`;
}

export function metricasApiHabilitadas(): boolean {
  return process.env.API_METRICAS !== "0";
}

/** Referência curta do tenant para logs (issue 001). */
export function referenciaEmpresaMetrica(empresaId?: string): string | undefined {
  if (!empresaId) return undefined;
  return empresaId.length > 10 ? empresaId.slice(0, 8) : empresaId;
}

/** Normaliza /api/foo/bar?id=1 → /api/foo/bar */
export function normalizarRotaApi(pathname: string): string {
  const semQuery = pathname.split("?")[0] || "/api";
  if (!semQuery.startsWith("/api")) return semQuery;
  return semQuery.replace(/\/+$/, "") || "/api";
}

export function registrarMetricaApi(entrada: Omit<MetricaApi, "em" | "empresaId"> & { empresaId?: string }) {
  if (!metricasApiHabilitadas()) return;

  const empresaId = entrada.empresaId;
  const registro: MetricaApi = { ...entrada, empresaId, em: Date.now() };
  buffer.push(registro);
  if (buffer.length > MAX_REGISTROS) buffer.shift();

  const k = chave(registro.rota, registro.metodo);
  const atual = acumulado.get(k);
  if (!atual) {
    acumulado.set(k, {
      rota: registro.rota,
      metodo: registro.metodo,
      chamadas: 1,
      duracaoTotalMs: registro.duracaoMs,
      duracaoMaxMs: registro.duracaoMs,
      erros: registro.status >= 400 ? 1 : 0,
      ultimoStatus: registro.status,
      ultimaEm: registro.em,
    });
  } else {
    atual.chamadas += 1;
    atual.duracaoTotalMs += registro.duracaoMs;
    atual.duracaoMaxMs = Math.max(atual.duracaoMaxMs, registro.duracaoMs);
    if (registro.status >= 400) atual.erros += 1;
    atual.ultimoStatus = registro.status;
    atual.ultimaEm = registro.em;
  }

  if (process.env.NODE_ENV !== "production") {
    const tag = registro.duracaoMs > 2000 ? "⚠" : registro.status >= 400 ? "✗" : "✓";
    const tenant = referenciaEmpresaMetrica(empresaId);
    const sufixoTenant = tenant ? ` tenant=${tenant}` : "";
    console.log(
      `[api-metrica] ${tag} ${registro.metodo} ${registro.rota} ${registro.duracaoMs}ms → ${registro.status}${sufixoTenant}`
    );
  }
}

export function resumoMetricasApi(limite = 20) {
  const linhas = [...acumulado.values()].map((a) => ({
    rota: a.rota,
    metodo: a.metodo,
    chamadas: a.chamadas,
    mediaMs: Math.round(a.duracaoTotalMs / a.chamadas),
    maxMs: a.duracaoMaxMs,
    erros: a.erros,
    ultimoStatus: a.ultimoStatus,
    ultimaEm: a.ultimaEm,
  }));

  const porTempo = [...linhas].sort((a, b) => b.mediaMs - a.mediaMs).slice(0, limite);
  const porVolume = [...linhas].sort((a, b) => b.chamadas - a.chamadas).slice(0, limite);

  return {
    totalRegistros: buffer.length,
    rotasDistintas: acumulado.size,
    maisLentas: porTempo,
    maisChamadas: porVolume,
    ultimas: buffer.slice(-Math.min(30, buffer.length)).reverse().map((r) => ({
      rota: r.rota,
      metodo: r.metodo,
      duracaoMs: r.duracaoMs,
      status: r.status,
      empresaId: referenciaEmpresaMetrica(r.empresaId),
      em: r.em,
    })),
  };
}

/** Envolve handler de route.ts para medir duração (útil com `next dev`). */
export function medirHandlerApi<T extends (...args: never[]) => Promise<Response>>(
  rota: string,
  handler: T
): T {
  const wrapped = async (...args: Parameters<T>): Promise<Response> => {
    const inicio = Date.now();
    const req = args[0] as Request | undefined;
    const metodo = req?.method ?? "GET";
    let status = 500;
    try {
      const res = await handler(...args);
      status = res.status;
      return res;
    } catch (erro) {
      status = 500;
      throw erro;
    } finally {
      registrarMetricaApi({
        rota: normalizarRotaApi(rota),
        metodo,
        duracaoMs: Date.now() - inicio,
        status,
      });
    }
  };
  return wrapped as T;
}
