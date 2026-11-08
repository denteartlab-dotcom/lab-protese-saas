import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  chaveInicioProducaoOs,
  statusContaTempoProducao,
} from "@/lib/tempo-producao-inicio";

export const TEMPO_PRODUCAO_INICIO_STORAGE_KEY = "labProteseTempoProducaoInicio";

export {
  chaveInicioProducaoOs,
  interpretarInicioProducaoOs,
  statusContaTempoProducao,
} from "@/lib/tempo-producao-inicio";

type MapaInicioProducao = Record<string, string>;

export async function lerInicioProducaoOsServidor(empresaId: string) {
  const mapa = await lerJsonStoreTenant<MapaInicioProducao>(
    empresaId,
    TEMPO_PRODUCAO_INICIO_STORAGE_KEY
  );
  return mapa && typeof mapa === "object" ? mapa : {};
}

export async function registrarInicioProducaoOsServidor(
  empresaId: string,
  chave: string,
  inicio = new Date()
) {
  const mapa = await lerInicioProducaoOsServidor(empresaId);
  mapa[chave] = inicio.toISOString();
  await salvarJsonStoreTenant(empresaId, TEMPO_PRODUCAO_INICIO_STORAGE_KEY, mapa);
}

export async function removerInicioProducaoOsServidor(empresaId: string, chave: string) {
  const mapa = await lerInicioProducaoOsServidor(empresaId);
  if (!(chave in mapa)) return;
  delete mapa[chave];
  await salvarJsonStoreTenant(empresaId, TEMPO_PRODUCAO_INICIO_STORAGE_KEY, mapa);
}

/**
 * Entrar em Produção começa a contagem naquele dia.
 * Sair para qualquer outra situação apaga o início e para a contagem.
 * Voltar para Produção grava um início novo, então os dias recomeçam.
 * Permanecer em Produção não reinicia o cronômetro.
 */
export async function sincronizarTempoProducaoPorMudancaStatus(
  empresaId: string,
  trabalho: { id: string; grupoOsId?: string | null },
  statusAnterior: string,
  statusNovo: string
) {
  const chave = chaveInicioProducaoOs(trabalho);
  const eraProducao = statusContaTempoProducao(statusAnterior);
  const ehProducao = statusContaTempoProducao(statusNovo);

  if (ehProducao && !eraProducao) {
    await registrarInicioProducaoOsServidor(empresaId, chave);
    return;
  }
  if (eraProducao && !ehProducao) {
    await removerInicioProducaoOsServidor(empresaId, chave);
  }
}
