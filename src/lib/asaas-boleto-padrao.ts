import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  JSON_KEY_BOLETO_ASAAS_PADRAO,
  PADRAO_BOLETO_ASAAS_VAZIO,
  montarPadraoBoletoAsaasParaSalvar,
  normalizarPadraoBoletoAsaas,
  type PadraoBoletoAsaas,
  type ValoresPadraoBoletoAsaas,
} from "@/lib/asaas-boleto-padrao-core";

export {
  JSON_KEY_BOLETO_ASAAS_PADRAO,
  PADRAO_BOLETO_ASAAS_VAZIO,
  montarPadraoBoletoAsaasParaSalvar,
  normalizarPadraoBoletoAsaas,
  resolverVencimentoPadraoBoletoAsaas,
  validarValoresPadraoBoletoAsaas,
  vencimentoPadraoBoletoAsaasBr,
  type PadraoBoletoAsaas,
  type TipoVencimentoBoletoAsaas,
  type ValoresPadraoBoletoAsaas,
} from "@/lib/asaas-boleto-padrao-core";

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
  valores: ValoresPadraoBoletoAsaas
): Promise<PadraoBoletoAsaas> {
  const padrao = montarPadraoBoletoAsaasParaSalvar(valores);
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
