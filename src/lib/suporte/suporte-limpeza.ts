import { prisma } from "@/lib/db";
import { excluirConversaSuporte } from "@/lib/suporte-chat";
import { limiteInatividadeSuporte } from "@/lib/suporte/suporte-inatividade";
import {
  emitSuporteConversaExpirada,
  emitSuporteConversasAtualizadas,
} from "@/lib/suporte/suporte-socket-server";

let timerLimpeza: ReturnType<typeof setInterval> | null = null;

export async function limparConversasSuporteInativas() {
  const limite = limiteInatividadeSuporte();
  const conversas = await prisma.suporteConversa.findMany({
    where: { ultimaMensagemEm: { lt: limite } },
    select: { id: true, empresaId: true },
  });

  if (conversas.length === 0) return 0;

  for (const conversa of conversas) {
    await excluirConversaSuporte(conversa.id, conversa.empresaId);
    emitSuporteConversaExpirada(conversa.empresaId);
  }

  emitSuporteConversasAtualizadas();
  return conversas.length;
}

export function iniciarLimpezaSuporteInativo() {
  if (timerLimpeza) return;

  const executar = () => {
    void limparConversasSuporteInativas().catch((erro) => {
      console.warn("[suporte] limpeza por inatividade falhou:", erro);
    });
  };

  executar();
  timerLimpeza = setInterval(executar, 60_000);

  if (typeof timerLimpeza.unref === "function") {
    timerLimpeza.unref();
  }
}
