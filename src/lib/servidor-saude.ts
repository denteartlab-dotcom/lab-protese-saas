import { prisma } from "@/lib/db";
import {
  bancoDisponivel,
  marcarBancoDisponivel,
  marcarBancoIndisponivel,
  tratarErroBancoSilencioso,
} from "@/lib/banco-circuit-breaker";
import { isErroConexaoBanco } from "@/lib/prisma-erro-conexao";

const INTERVALO_KEEPALIVE_MS = 4 * 60 * 1000;
const TENTATIVAS_INICIO = 10;
const INTERVALO_INICIO_MS = 2_000;

let timerKeepalive: ReturnType<typeof setInterval> | null = null;

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aguarda Postgres ficar acessível (útil após boot ou queda de energia). */
export async function aguardarBancoDisponivel(
  tentativas = TENTATIVAS_INICIO,
  intervaloMs = INTERVALO_INICIO_MS
): Promise<boolean> {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      marcarBancoDisponivel();
      return true;
    } catch (erro) {
      if (!isErroConexaoBanco(erro)) throw erro;
      if (i < tentativas) {
        console.warn(
          `[servidor-saude] Postgres indisponível (tentativa ${i}/${tentativas}) — aguardando ${intervaloMs / 1000}s…`
        );
        await aguardar(intervaloMs);
        continue;
      }
      marcarBancoIndisponivel(erro);
      return false;
    }
  }
  return false;
}

/** Garante conexão ativa com o Postgres (reconecta se caiu após ociosidade). */
export async function aquecerConexaoBanco() {
  if (!bancoDisponivel()) {
    const ok = await aguardarBancoDisponivel(1, 0);
    if (!ok) return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    marcarBancoDisponivel();
    return true;
  } catch (erro) {
    if (tratarErroBancoSilencioso(erro)) return false;
    throw erro;
  }
}

export async function aquecerServidor() {
  const ok = await aguardarBancoDisponivel();
  if (ok) {
    console.log("> Banco de dados conectado");
  } else {
    console.warn(
      "> Postgres ainda indisponível — servidor sobe; keepalive retenta em background."
    );
  }
}

/** Ping periódico no banco evita primeira requisição falhar após horas sem uso. */
export function iniciarManutencaoServidor() {
  if (timerKeepalive) return;

  timerKeepalive = setInterval(() => {
    void aquecerConexaoBanco();
  }, INTERVALO_KEEPALIVE_MS);

  if (typeof timerKeepalive.unref === "function") {
    timerKeepalive.unref();
  }
}
