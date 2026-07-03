import { isErroConexaoBanco } from "@/lib/prisma-erro-conexao";

const COOLDOWN_MS = 30_000;
const INTERVALO_LOG_MS = 60_000;

let disponivel = true;
let proximaTentativa = 0;
let ultimoLogIndisponivel = 0;

export function bancoEmCooldown(): boolean {
  return Date.now() < proximaTentativa;
}

export function bancoDisponivel(): boolean {
  return disponivel && !bancoEmCooldown();
}

export function deveTentarBanco(): boolean {
  return bancoDisponivel();
}

/** Alias usado por tarefas em segundo plano (TV refresh, backup). */
export function deveTentarBancoSegundoPlano(): boolean {
  return deveTentarBanco();
}

export function marcarBancoIndisponivel(_erro?: unknown) {
  disponivel = false;
  proximaTentativa = Date.now() + COOLDOWN_MS;
  const agora = Date.now();
  if (agora - ultimoLogIndisponivel >= INTERVALO_LOG_MS) {
    ultimoLogIndisponivel = agora;
    console.warn(
      "[banco] PostgreSQL indisponível — tarefas em segundo plano pausadas (retenta em ~30s)."
    );
  }
}

export function marcarBancoDisponivel() {
  if (!disponivel) {
    console.log("[banco] PostgreSQL restabelecido.");
  }
  disponivel = true;
  proximaTentativa = 0;
}

/** Executa consulta; em falha de conexão retorna null sem propagar. */
export async function comProtecaoBanco<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!deveTentarBanco()) return null;
  try {
    const resultado = await fn();
    marcarBancoDisponivel();
    return resultado;
  } catch (erro) {
    if (isErroConexaoBanco(erro)) {
      marcarBancoIndisponivel(erro);
      return null;
    }
    throw erro;
  }
}

type OpcoesCircuitBreaker = {
  segundoPlano?: boolean;
};

/**
 * Executa fn com circuit breaker.
 * Em segundo plano retorna null se banco indisponível; em requisições tenta normalmente.
 */
export async function executarComCircuitBreakerBanco<T>(
  fn: () => Promise<T>,
  opcoes?: OpcoesCircuitBreaker
): Promise<T | null> {
  if (opcoes?.segundoPlano && !deveTentarBancoSegundoPlano()) {
    return null;
  }
  return comProtecaoBanco(fn);
}

export function tratarErroBancoSilencioso(erro: unknown): boolean {
  if (!isErroConexaoBanco(erro)) return false;
  marcarBancoIndisponivel(erro);
  return true;
}
