import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

export const JSON_KEY_BOLETO_ASAAS_PADRAO = "labProteseBoletoAsaasPadrao";

export type PadraoBoletoAsaas = {
  cadastrado: boolean;
  interest: number;
  fine: number;
};

export const PADRAO_BOLETO_ASAAS_VAZIO: PadraoBoletoAsaas = {
  cadastrado: false,
  interest: 0,
  fine: 0,
};

function clampPercentual(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

export function normalizarPadraoBoletoAsaas(
  raw: Partial<PadraoBoletoAsaas> | null | undefined
): PadraoBoletoAsaas {
  if (!raw || raw.cadastrado !== true) return { ...PADRAO_BOLETO_ASAAS_VAZIO };
  return {
    cadastrado: true,
    interest: clampPercentual(raw.interest),
    fine: clampPercentual(raw.fine),
  };
}

export async function obterPadraoBoletoAsaas(
  empresaId: string
): Promise<PadraoBoletoAsaas> {
  const raw = await lerJsonStoreTenant<Partial<PadraoBoletoAsaas>>(
    empresaId,
    JSON_KEY_BOLETO_ASAAS_PADRAO
  );
  return normalizarPadraoBoletoAsaas(raw);
}

export async function salvarPadraoBoletoAsaas(
  empresaId: string,
  valores: { interest: number; fine: number }
): Promise<PadraoBoletoAsaas> {
  const padrao: PadraoBoletoAsaas = {
    cadastrado: true,
    interest: clampPercentual(valores.interest),
    fine: clampPercentual(valores.fine),
  };
  await salvarJsonStoreTenant(empresaId, JSON_KEY_BOLETO_ASAAS_PADRAO, padrao);
  return padrao;
}

export async function limparPadraoBoletoAsaas(empresaId: string) {
  await salvarJsonStoreTenant(
    empresaId,
    JSON_KEY_BOLETO_ASAAS_PADRAO,
    PADRAO_BOLETO_ASAAS_VAZIO
  );
  return { ...PADRAO_BOLETO_ASAAS_VAZIO };
}
