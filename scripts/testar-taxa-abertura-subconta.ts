import {
  deveCobrarTaxaAberturaSubconta,
  onboardingUrlAindaValida,
  urlOnboardingAsaasPermitida,
  VALOR_TAXA_ABERTURA_SUBCONTA,
} from "../src/lib/taxa-abertura-subconta-const";

function assert(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(mensagem);
}

assert(VALOR_TAXA_ABERTURA_SUBCONTA === 15, "taxa única é R$ 15");
assert(
  deveCobrarTaxaAberturaSubconta({ subcontaCriada: false, taxaPaga: false }),
  "sem conta e sem pagamento mostra a taxa"
);
assert(
  !deveCobrarTaxaAberturaSubconta({ subcontaCriada: false, taxaPaga: true }),
  "taxa paga segue para o cadastro"
);
assert(
  !deveCobrarTaxaAberturaSubconta({ subcontaCriada: true, taxaPaga: false }),
  "conta já criada abre direto o envio"
);
assert(
  urlOnboardingAsaasPermitida("https://www.asaas.com/onboarding/abc"),
  "link do Asaas pode ser reaberto"
);
assert(!urlOnboardingAsaasPermitida("https://evil.com/asaas.com"), "host de fora é recusado");
assert(!urlOnboardingAsaasPermitida("javascript:alert(1)"), "url sem https é recusada");
assert(onboardingUrlAindaValida(null), "link sem prazo continua valendo");
assert(
  !onboardingUrlAindaValida(new Date(Date.now() - 5 * 60_000).toISOString()),
  "link vencido não é reutilizado"
);
assert(
  onboardingUrlAindaValida(new Date(Date.now() + 60 * 60_000).toISOString()),
  "link no prazo é reutilizado"
);

console.log("ok: taxa única da subconta");
