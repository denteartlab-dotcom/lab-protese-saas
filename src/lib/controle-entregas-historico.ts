import {
  mesclarHistorico,
  normalizarHistorico,
  type EntregaHistorico,
} from "@/lib/controle-entregas-historico-core";

export {
  ENTREGAS_HISTORICO_EVENT,
  ENTREGAS_HISTORICO_STORAGE_KEY,
  carregarHistoricoEntregas,
  entregaParaHistorico,
  excluirHistoricoEntrega,
  mesclarHistorico,
  normalizarHistorico,
  registrarHistoricoEntregas,
  salvarHistoricoEntregas,
  sincronizarHistoricoEntregasCliente,
  type EntregaHistorico,
  type SituacaoHistoricoEntrega,
} from "@/lib/controle-entregas-historico-core";

export {
  excluirHistoricoEntregaPersistido,
  imprimirHistoricoEntregas,
  labelSituacaoHistorico,
  persistirHistoricoEntregasServidor,
  textoHistoricoEntrega,
} from "@/lib/controle-entregas-historico-cliente";

/** Persiste histórico no JsonStore do tenant. */
export async function registrarHistoricoEntregasServidor(
  empresaId: string,
  novos: EntregaHistorico[]
) {
  if (novos.length === 0) return;
  const { lerJsonStoreTenant, salvarJsonStoreTenant } = await import(
    "@/lib/json-store-tenant"
  );
  const { ENTREGAS_HISTORICO_STORAGE_KEY } = await import(
    "@/lib/controle-entregas-historico-core"
  );
  const atual =
    (await lerJsonStoreTenant<EntregaHistorico[]>(empresaId, ENTREGAS_HISTORICO_STORAGE_KEY)) ??
    [];
  const normalizada = Array.isArray(atual) ? atual : [];
  const mesclada = mesclarHistorico(
    normalizada
      .map((item) => normalizarHistorico(item))
      .filter((item): item is EntregaHistorico => Boolean(item)),
    novos
  );
  await salvarJsonStoreTenant(empresaId, ENTREGAS_HISTORICO_STORAGE_KEY, mesclada);
}
