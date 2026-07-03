import { ENTREGAS_STORAGE_KEY, type EntregaControle } from "@/lib/controle-entregas";
import { registrarHistoricoEntregasServidor } from "@/lib/controle-entregas-historico";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  arquivarEntregasDaLista,
  type SituacaoConclusaoEntrega,
} from "@/lib/entrega-trabalho-sync-cliente";

/** Remove do controle ativo e grava no histórico (JsonStore do tenant). */
export async function concluirEntregasControlePorNumeroOsServidor(
  empresaId: string,
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const lista =
    (await lerJsonStoreTenant<EntregaControle[]>(empresaId, ENTREGAS_STORAGE_KEY)) ?? [];
  const normalizada = Array.isArray(lista) ? lista : [];
  const { restantes, historico, mudou } = arquivarEntregasDaLista(
    normalizada,
    numeroOs,
    opcoes
  );
  if (!mudou) return false;
  await salvarJsonStoreTenant(empresaId, ENTREGAS_STORAGE_KEY, restantes);
  await registrarHistoricoEntregasServidor(empresaId, historico);
  return true;
}
