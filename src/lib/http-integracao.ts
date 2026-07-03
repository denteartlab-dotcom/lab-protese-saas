/**
 * Cliente HTTP para integrações externas (issue 025).
 * Timeout padrão 30s, retry limitado e circuit breaker por integração.
 */

export type IntegracaoHttpNome =
  | "asaas"
  | "mercado-pago"
  | "pluggy"
  | "resend"
  | "nfse"
  | "generico";

export type OpcoesFetchIntegracao = {
  integracao?: IntegracaoHttpNome;
  timeoutMs?: number;
  /** Tentativas extras após a primeira (padrão: 2 → até 3 chamadas). */
  maxRetries?: number;
};

export class ErroIntegracaoHttp extends Error {
  readonly codigo: "timeout" | "rede" | "circuit_aberto" | "http";
  readonly integracao: IntegracaoHttpNome;
  readonly status?: number;
  readonly url?: string;

  constructor(
    message: string,
    opcoes: {
      codigo: ErroIntegracaoHttp["codigo"];
      integracao: IntegracaoHttpNome;
      status?: number;
      url?: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: opcoes.cause });
    this.name = "ErroIntegracaoHttp";
    this.codigo = opcoes.codigo;
    this.integracao = opcoes.integracao;
    this.status = opcoes.status;
    this.url = opcoes.url;
  }
}

const TIMEOUT_PADRAO_MS = 30_000;
const MAX_RETRIES_PADRAO = 2;
const FALHAS_PARA_ABRIR_CIRCUITO = 5;
const COOLDOWN_CIRCUITO_MS = 60_000;

type EstadoCircuito = {
  falhasConsecutivas: number;
  abertoAte: number;
};

const globalIntegracao = globalThis as typeof globalThis & {
  __httpIntegracaoCircuitos?: Map<IntegracaoHttpNome, EstadoCircuito>;
};

function circuitos(): Map<IntegracaoHttpNome, EstadoCircuito> {
  if (!globalIntegracao.__httpIntegracaoCircuitos) {
    globalIntegracao.__httpIntegracaoCircuitos = new Map();
  }
  return globalIntegracao.__httpIntegracaoCircuitos;
}

function timeoutIntegracaoMs(): number {
  const raw = process.env.HTTP_INTEGRACAO_TIMEOUT_MS?.trim();
  if (!raw) return TIMEOUT_PADRAO_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : TIMEOUT_PADRAO_MS;
}

function maxRetriesIntegracao(): number {
  const raw = process.env.HTTP_INTEGRACAO_MAX_RETRIES?.trim();
  if (!raw) return MAX_RETRIES_PADRAO;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : MAX_RETRIES_PADRAO;
}

function logIntegracao(
  nivel: "warn" | "error",
  evento: string,
  dados: Record<string, unknown>
) {
  const linha = JSON.stringify({ evento, ...dados, em: new Date().toISOString() });
  if (nivel === "error") {
    console.error(`[http-integracao] ${linha}`);
  } else {
    console.warn(`[http-integracao] ${linha}`);
  }
}

function verificarCircuito(integracao: IntegracaoHttpNome) {
  const estado = circuitos().get(integracao);
  if (!estado) return;

  if (estado.abertoAte > Date.now()) {
    throw new ErroIntegracaoHttp(
      `Integração ${integracao} temporariamente indisponível (circuit breaker).`,
      { codigo: "circuit_aberto", integracao }
    );
  }

  if (estado.abertoAte > 0) {
    circuitos().delete(integracao);
  }
}

function registrarFalhaCircuito(integracao: IntegracaoHttpNome) {
  const mapa = circuitos();
  const atual = mapa.get(integracao) ?? { falhasConsecutivas: 0, abertoAte: 0 };
  atual.falhasConsecutivas += 1;

  if (atual.falhasConsecutivas >= FALHAS_PARA_ABRIR_CIRCUITO) {
    atual.abertoAte = Date.now() + COOLDOWN_CIRCUITO_MS;
    logIntegracao("warn", "circuit_aberto", {
      integracao,
      falhas: atual.falhasConsecutivas,
      cooldownMs: COOLDOWN_CIRCUITO_MS,
    });
  }

  mapa.set(integracao, atual);
}

function registrarSucessoCircuito(integracao: IntegracaoHttpNome) {
  circuitos().delete(integracao);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function backoffMs(tentativa: number) {
  return Math.min(500 * 2 ** tentativa, 4_000);
}

function ehAbortTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"))
  );
}

function deveRetentarStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function deveRetentarErro(err: unknown): boolean {
  if (ehAbortTimeout(err)) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof ErroIntegracaoHttp && err.codigo === "rede") return true;
  return false;
}

function vincularAbortExterno(
  controller: AbortController,
  externo?: AbortSignal | null
) {
  if (!externo) return;
  if (externo.aborted) {
    controller.abort();
    return;
  }
  externo.addEventListener("abort", () => controller.abort(), { once: true });
}

/** fetch com timeout, retry e circuit breaker. */
export async function fetchComTimeout(
  url: string,
  init?: RequestInit,
  opcoes?: OpcoesFetchIntegracao
): Promise<Response> {
  const integracao = opcoes?.integracao ?? "generico";
  const timeoutMs = opcoes?.timeoutMs ?? timeoutIntegracaoMs();
  const maxRetries = opcoes?.maxRetries ?? maxRetriesIntegracao();

  verificarCircuito(integracao);

  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa <= maxRetries; tentativa++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    vincularAbortExterno(controller, init?.signal);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok && tentativa < maxRetries && deveRetentarStatus(res.status)) {
        logIntegracao("warn", "retry_http", {
          integracao,
          url,
          status: res.status,
          tentativa: tentativa + 1,
        });
        await sleep(backoffMs(tentativa));
        continue;
      }

      if (!res.ok) {
        registrarFalhaCircuito(integracao);
      } else {
        registrarSucessoCircuito(integracao);
      }

      return res;
    } catch (err) {
      clearTimeout(timer);
      ultimoErro = err;

      if (tentativa < maxRetries && deveRetentarErro(err)) {
        logIntegracao("warn", "retry_rede", {
          integracao,
          url,
          tentativa: tentativa + 1,
          erro: err instanceof Error ? err.message : String(err),
        });
        await sleep(backoffMs(tentativa));
        continue;
      }

      registrarFalhaCircuito(integracao);

      if (ehAbortTimeout(err)) {
        throw new ErroIntegracaoHttp(`Timeout após ${timeoutMs}ms em ${integracao}.`, {
          codigo: "timeout",
          integracao,
          url,
          cause: err,
        });
      }

      throw new ErroIntegracaoHttp(
        err instanceof Error ? err.message : `Falha de rede em ${integracao}.`,
        { codigo: "rede", integracao, url, cause: err }
      );
    }
  }

  if (ultimoErro instanceof ErroIntegracaoHttp) throw ultimoErro;
  throw new ErroIntegracaoHttp(`Falha em ${integracao} após retries.`, {
    codigo: "rede",
    integracao,
    url,
    cause: ultimoErro,
  });
}

/** Envolve qualquer Promise (ex.: SDK Resend) com timeout. */
export async function promessaComTimeout<T>(
  promessa: Promise<T>,
  opcoes?: { integracao?: IntegracaoHttpNome; timeoutMs?: number; rotulo?: string }
): Promise<T> {
  const integracao = opcoes?.integracao ?? "generico";
  const timeoutMs = opcoes?.timeoutMs ?? timeoutIntegracaoMs();
  verificarCircuito(integracao);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resultado = await Promise.race([
      promessa,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new ErroIntegracaoHttp(
              `Timeout após ${timeoutMs}ms em ${opcoes?.rotulo || integracao}.`,
              { codigo: "timeout", integracao }
            )
          );
        }, timeoutMs);
      }),
    ]);
    registrarSucessoCircuito(integracao);
    return resultado;
  } catch (err) {
    registrarFalhaCircuito(integracao);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
