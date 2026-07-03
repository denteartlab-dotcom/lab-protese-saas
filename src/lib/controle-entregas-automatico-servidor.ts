import {
  CONFIG_GERAIS_STORAGE_KEY,
  normalizarConfiguracoesGerais,
  type ConfiguracoesGerais,
} from "@/lib/configuracoes-gerais";
import { ENTREGAS_STORAGE_KEY, type EntregaControle } from "@/lib/controle-entregas";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  entregaJaExisteParaOs,
  filtrarEntregasPorNumeroOs,
  montarEntregaDeTrabalho,
  situacaoInicialEntregaAutomatica,
  type TrabalhoParaControleEntrega,
} from "@/lib/controle-entregas-automatico-cliente";

/** Persiste no JsonStore do tenant (API / TV / múltiplas abas). */
export async function adicionarTrabalhoControleEntregasAutomaticoServidor(
  empresaId: string,
  trabalho: TrabalhoParaControleEntrega,
  opcoes?: { origem?: "status" | "manual"; ignorarConfig?: boolean }
) {
  if (!opcoes?.ignorarConfig) {
    const configRaw = await lerJsonStoreTenant(empresaId, CONFIG_GERAIS_STORAGE_KEY);
    const config = normalizarConfiguracoesGerais(
      configRaw as Partial<ConfiguracoesGerais> | null
    );
    if (!config.faturasAdicionarControleEntregas) return false;
  }

  const lista =
    (await lerJsonStoreTenant<EntregaControle[]>(empresaId, ENTREGAS_STORAGE_KEY)) ?? [];
  const normalizada = Array.isArray(lista) ? lista : [];
  if (entregaJaExisteParaOs(normalizada, trabalho.numeroOs)) return false;

  const nova: EntregaControle = {
    id: `ent-${Date.now()}-${trabalho.id.slice(0, 8)}`,
    ...montarEntregaDeTrabalho(
      trabalho,
      situacaoInicialEntregaAutomatica(opcoes?.origem)
    ),
  };

  await salvarJsonStoreTenant(empresaId, ENTREGAS_STORAGE_KEY, [...normalizada, nova]);
  return true;
}

export async function removerTrabalhoControleEntregasAutomaticoServidor(
  empresaId: string,
  numeroOs: number
) {
  const lista =
    (await lerJsonStoreTenant<EntregaControle[]>(empresaId, ENTREGAS_STORAGE_KEY)) ?? [];
  const normalizada = Array.isArray(lista) ? lista : [];
  const filtrada = filtrarEntregasPorNumeroOs(normalizada, numeroOs);
  if (filtrada.length === normalizada.length) return false;
  await salvarJsonStoreTenant(empresaId, ENTREGAS_STORAGE_KEY, filtrada);
  return true;
}
