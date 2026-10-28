/** Cobrança avulsa: não renova a assinatura do laboratório. */
export const PLANO_TAXA_ABERTURA_SUBCONTA = "taxa_abertura_subconta";

/** Taxa única para abrir a subconta Asaas. */
export const VALOR_TAXA_ABERTURA_SUBCONTA = 15;

export const VALOR_TAXA_ABERTURA_SUBCONTA_FORMATADO = "R$ 15,00";

export function cobrancaEhTaxaAberturaSubconta(plano: string | null | undefined) {
  return plano === PLANO_TAXA_ABERTURA_SUBCONTA;
}

/** Conta ainda não criada no Asaas e taxa ainda não paga. */
export function deveCobrarTaxaAberturaSubconta(opcoes: {
  subcontaCriada: boolean;
  taxaPaga: boolean;
}) {
  if (opcoes.subcontaCriada) return false;
  return !opcoes.taxaPaga;
}

/** Só abre link https do próprio Asaas. */
export function urlOnboardingAsaasPermitida(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "asaas.com" || host.endsWith(".asaas.com");
  } catch {
    return false;
  }
}

/** Link de envio já conhecido continua válido até perto do vencimento. */
export function onboardingUrlAindaValida(
  expiraEm?: string | null,
  agora = Date.now()
) {
  if (!expiraEm) return true;
  const instante = new Date(expiraEm).getTime();
  if (!Number.isFinite(instante)) return true;
  return instante > agora + 60_000;
}
