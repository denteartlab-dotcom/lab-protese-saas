import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

export const JSON_KEY_CONTA_DIGITAL_PIX = "labProteseContaDigitalPix";

export type ConfigLimitePixContaDigital = {
  ativo: boolean;
  limiteDiario: number | null;
  /** yyyy-mm-dd do último registro de uso */
  dataUso?: string;
  usadoNoDia?: number;
  atualizadoEm?: string;
};

export type ResumoLimitePixContaDigital = {
  ativo: boolean;
  limiteDiario: number | null;
  usadoHoje: number;
  disponivelHoje: number | null;
};

function hojeIsoLocal() {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizarConfig(raw: Partial<ConfigLimitePixContaDigital> | null): ConfigLimitePixContaDigital {
  const limite =
    raw?.limiteDiario != null && Number.isFinite(Number(raw.limiteDiario))
      ? Math.max(0, Number(raw.limiteDiario))
      : null;
  const hoje = hojeIsoLocal();
  const dataUso = raw?.dataUso === hoje ? hoje : hoje;
  const usadoNoDia =
    raw?.dataUso === hoje && Number.isFinite(Number(raw?.usadoNoDia))
      ? Math.max(0, Number(raw.usadoNoDia))
      : 0;

  return {
    ativo: Boolean(raw?.ativo) && limite != null && limite > 0,
    limiteDiario: limite,
    dataUso,
    usadoNoDia,
    atualizadoEm: raw?.atualizadoEm,
  };
}

export async function obterConfigLimitePixContaDigital(
  empresaId: string
): Promise<ConfigLimitePixContaDigital> {
  const raw = await lerJsonStoreTenant<Partial<ConfigLimitePixContaDigital>>(
    empresaId,
    JSON_KEY_CONTA_DIGITAL_PIX
  );
  return normalizarConfig(raw);
}

export async function salvarConfigLimitePixContaDigital(
  empresaId: string,
  params: { ativo: boolean; limiteDiario: number | null }
) {
  const limite =
    params.limiteDiario != null && Number.isFinite(params.limiteDiario)
      ? Math.max(0, Number(params.limiteDiario))
      : null;
  const ativo = Boolean(params.ativo) && limite != null && limite > 0;

  const atual = await obterConfigLimitePixContaDigital(empresaId);
  const proximo: ConfigLimitePixContaDigital = {
    ...atual,
    ativo,
    limiteDiario: limite,
    atualizadoEm: new Date().toISOString(),
  };

  await salvarJsonStoreTenant(empresaId, JSON_KEY_CONTA_DIGITAL_PIX, proximo);
  return proximo;
}

export function montarResumoLimitePix(config: ConfigLimitePixContaDigital): ResumoLimitePixContaDigital {
  const hoje = hojeIsoLocal();
  const usadoHoje = config.dataUso === hoje ? config.usadoNoDia || 0 : 0;
  const limite = config.ativo && config.limiteDiario ? config.limiteDiario : null;

  return {
    ativo: Boolean(limite),
    limiteDiario: limite,
    usadoHoje,
    disponivelHoje: limite != null ? Math.max(0, limite - usadoHoje) : null,
  };
}

export async function obterResumoLimitePixContaDigital(empresaId: string) {
  const config = await obterConfigLimitePixContaDigital(empresaId);
  return montarResumoLimitePix(config);
}

export async function validarLimitePixDiarioContaDigital(empresaId: string, valor: number) {
  const config = await obterConfigLimitePixContaDigital(empresaId);
  const resumo = montarResumoLimitePix(config);

  if (!resumo.ativo || resumo.limiteDiario == null) {
    return resumo;
  }

  const valorNum = Number(valor.toFixed(2));
  if (valorNum <= 0) {
    throw new Error("Informe um valor válido.");
  }

  if (resumo.usadoHoje + valorNum > resumo.limiteDiario + 0.001) {
    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    throw new Error(
      `Limite diário de Pix (${fmt(resumo.limiteDiario)}) excedido. Já transferido hoje: ${fmt(resumo.usadoHoje)}. Disponível: ${fmt(resumo.disponivelHoje ?? 0)}.`
    );
  }

  return resumo;
}

export async function registrarPixTransferidoContaDigital(empresaId: string, valor: number) {
  const config = await obterConfigLimitePixContaDigital(empresaId);
  const hoje = hojeIsoLocal();
  const valorNum = Number(valor.toFixed(2));
  const usadoNoDia =
    config.dataUso === hoje ? (config.usadoNoDia || 0) + valorNum : valorNum;

  const proximo: ConfigLimitePixContaDigital = {
    ...config,
    dataUso: hoje,
    usadoNoDia: Number(usadoNoDia.toFixed(2)),
  };

  await salvarJsonStoreTenant(empresaId, JSON_KEY_CONTA_DIGITAL_PIX, proximo);
  return montarResumoLimitePix(proximo);
}
