import {
  CONFIG_OS_STORAGE_KEY,
  normalizarConfiguracoesOs,
  type ConfiguracoesOs,
} from "@/lib/configuracoes-os";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";

/** Configurações de impressão da OS gravadas em Configurações › Ordem de serviço. */
export async function carregarConfiguracoesOsServidor(
  empresaId: string
): Promise<ConfiguracoesOs> {
  const remoto = await lerJsonStoreTenant<Partial<ConfiguracoesOs>>(
    empresaId,
    CONFIG_OS_STORAGE_KEY
  );
  return normalizarConfiguracoesOs(remoto);
}
