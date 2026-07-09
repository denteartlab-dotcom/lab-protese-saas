import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { grupoOsIdOf } from "@/lib/trabalho-os-segmento";

export const TEMPO_PRODUCAO_INICIO_STORAGE_KEY = "labProteseTempoProducaoInicio";

type MapaInicioProducao = Record<string, string>;

export function chaveInicioProducaoOs(trabalho: {
  id: string;
  grupoOsId?: string | null;
}) {
  return grupoOsIdOf(trabalho);
}

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

export function interpretarInicioProducaoOs(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function statusContaTempoProducao(status?: string | null) {
  return normalizarChaveStatusOs(status) === "producao";
}

/** Registra início ao entrar em Produção; remove ao sair; reinicia o cronômetro ao retornar. */
export async function sincronizarTempoProducaoPorMudancaStatus(
  empresaId: string,
  trabalho: { id: string; grupoOsId?: string | null },
  statusAnterior: string,
  statusNovo: string
) {
  const chave = chaveInicioProducaoOs(trabalho);
  const eraProducao = statusContaTempoProducao(statusAnterior);
  const ehProducao = statusContaTempoProducao(statusNovo);

  if (ehProducao) {
    await registrarInicioProducaoOsServidor(empresaId, chave);
    return;
  }
  if (eraProducao) {
    await removerInicioProducaoOsServidor(empresaId, chave);
  }
}
