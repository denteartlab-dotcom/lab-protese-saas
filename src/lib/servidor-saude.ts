import { prisma } from "@/lib/db";

const INTERVALO_KEEPALIVE_MS = 4 * 60 * 1000;

let timerKeepalive: ReturnType<typeof setInterval> | null = null;

/** Garante conexão ativa com o Postgres (reconecta se caiu após ociosidade). */
export async function aquecerConexaoBanco() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (erro) {
    console.warn("[servidor-saude] reconectando banco:", erro);
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  }
}

export async function aquecerServidor() {
  await aquecerConexaoBanco();
}

/** Ping periódico no banco evita primeira requisição falhar após horas sem uso. */
export function iniciarManutencaoServidor() {
  if (timerKeepalive) return;

  timerKeepalive = setInterval(() => {
    void aquecerConexaoBanco().catch((erro) => {
      console.warn("[servidor-saude] keepalive falhou:", erro);
    });
  }, INTERVALO_KEEPALIVE_MS);

  if (typeof timerKeepalive.unref === "function") {
    timerKeepalive.unref();
  }
}
