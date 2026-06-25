import {
  carregarEntregas,
  ENTREGAS_STORAGE_KEY,
  salvarEntregas,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

export const STATUS_ENTREGUE_CLIENTE = "entregue_cliente";

export type SituacaoConclusaoEntrega = Extract<SituacaoEntrega, "entregue" | "recebido">;

function aplicarConclusaoEntrega(
  item: EntregaControle,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
): EntregaControle {
  const agora = new Date().toISOString();
  return {
    ...item,
    situacao: opcoes.situacao,
    dataFinalizado: agora,
    nomeRecebedor: opcoes.nomeRecebedor?.trim() || item.nomeRecebedor || "",
  };
}

function deveAtualizarEntrega(item: EntregaControle, novaSituacao: SituacaoConclusaoEntrega) {
  if (novaSituacao === "recebido") return item.situacao !== "recebido";
  return item.situacao === "pendente" || item.situacao === "em_rota";
}

function atualizarListaEntregasPorOs(
  lista: EntregaControle[],
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const alvo = String(numeroOs);
  let mudou = false;
  const atualizada = lista.map((item) => {
    if (String(item.numeroOs || "").trim() !== alvo) return item;
    if (!deveAtualizarEntrega(item, opcoes.situacao)) return item;
    mudou = true;
    return aplicarConclusaoEntrega(item, opcoes);
  });
  return { atualizada, mudou };
}

/** Conclui entregas do Controle vinculadas à OS (navegador). */
export function concluirEntregasControlePorNumeroOs(
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const { atualizada, mudou } = atualizarListaEntregasPorOs(
    carregarEntregas(),
    numeroOs,
    opcoes
  );
  if (mudou) salvarEntregas(atualizada);
  return mudou;
}

/** Conclui entregas do Controle vinculadas à OS (JsonStore do tenant). */
export async function concluirEntregasControlePorNumeroOsServidor(
  empresaId: string,
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const lista =
    (await lerJsonStoreTenant<EntregaControle[]>(empresaId, ENTREGAS_STORAGE_KEY)) ?? [];
  const normalizada = Array.isArray(lista) ? lista : [];
  const { atualizada, mudou } = atualizarListaEntregasPorOs(normalizada, numeroOs, opcoes);
  if (!mudou) return false;
  await salvarJsonStoreTenant(empresaId, ENTREGAS_STORAGE_KEY, atualizada);
  return true;
}
