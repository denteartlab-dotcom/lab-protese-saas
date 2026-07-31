import {
  executarComCircuitBreakerBanco,
  tratarErroBancoSilencioso,
} from "@/lib/banco-circuit-breaker";
import { executarSemRls, runWithTenantContext } from "@/lib/db";
import { isErroConexaoBanco } from "@/lib/prisma-erro-conexao";
import { excluirConversaSuporte } from "@/lib/suporte-chat";
import { limiteInatividadeSuporte } from "@/lib/suporte/suporte-inatividade";
import {
  emitSuporteConversaExpirada,
  emitSuporteConversasAtualizadas,
} from "@/lib/suporte/suporte-socket-server";

let timerLimpeza: ReturnType<typeof setInterval> | null = null;

export async function limparConversasSuporteInativas() {
  const limite = limiteInatividadeSuporte();
  const conversas = await executarComCircuitBreakerBanco(
    () =>
      executarSemRls((tx) =>
        tx.suporteConversa.findMany({
          where: { ultimaMensagemEm: { lt: limite } },
          select: { id: true, empresaId: true },
        })
      ),
    { segundoPlano: true }
  );

  if (!conversas || conversas.length === 0) return 0;

  for (const conversa of conversas) {
    await runWithTenantContext(conversa.empresaId, () =>
      excluirConversaSuporte(conversa.id, conversa.empresaId)
    );
    emitSuporteConversaExpirada(conversa.empresaId);
  }

  emitSuporteConversasAtualizadas();
  return conversas.length;
}

export function iniciarLimpezaSuporteInativo() {
  if (timerLimpeza) return;

  const executar = () => {
    void limparConversasSuporteInativas().catch((erro) => {
      if (isErroConexaoBanco(erro)) {
        tratarErroBancoSilencioso(erro);
        return;
      }
      console.warn("[suporte] limpeza por inatividade falhou:", erro);
    });
  };

  executar();
  timerLimpeza = setInterval(executar, 60_000);

  if (typeof timerLimpeza.unref === "function") {
    timerLimpeza.unref();
  }
}
