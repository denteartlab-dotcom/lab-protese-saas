import { prisma } from "@/lib/db";
import { cobrancaAssinaturaPixAberta, statusCobrancaAssinaturaPago } from "@/lib/assinatura-pix-provedor";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  criarPixAssinaturaMercadoPago,
  obterPixMercadoPagoPlataforma,
} from "@/lib/mercadopago-plataforma";
import { mercadoPagoPlataformaConfigurado } from "@/lib/mercadopago-plataforma-config";
import {
  PLANO_TAXA_ABERTURA_SUBCONTA,
  VALOR_TAXA_ABERTURA_SUBCONTA,
  VALOR_TAXA_ABERTURA_SUBCONTA_FORMATADO,
  onboardingUrlAindaValida,
  urlOnboardingAsaasPermitida,
} from "@/lib/taxa-abertura-subconta-const";

const CHAVE_ESTADO = "taxaAberturaSubcontaAsaas";

type EstadoTaxaAbertura = {
  exigirNovaTaxaApos?: string | null;
  cadastroAbertoEm?: string | null;
  onboardingUrl?: string | null;
  onboardingUrlExpiraEm?: string | null;
};

export type ResumoTaxaAberturaSubconta = {
  valor: number;
  valorFormatado: string;
  paga: boolean;
  cadastroAberto: boolean;
  onboardingUrl: string | null;
  onboardingUrlExpiraEm: string | null;
  cobranca: {
    cobrancaId: string;
    paymentId: string;
    pixPayload: string | null;
    pixEncodedImage: string | null;
    pixExpiraEm: string | null;
    pago: boolean;
  } | null;
};

function estadoVazio(): EstadoTaxaAbertura {
  return {};
}

async function lerEstado(empresaId: string): Promise<EstadoTaxaAbertura> {
  const salvo = await lerJsonStoreTenant<EstadoTaxaAbertura>(empresaId, CHAVE_ESTADO, {
    ignorarCache: true,
  });
  return salvo || estadoVazio();
}

async function gravarEstado(empresaId: string, estado: EstadoTaxaAbertura) {
  await salvarJsonStoreTenant(empresaId, CHAVE_ESTADO, estado);
}

function corteNovaTaxa(estado: EstadoTaxaAbertura): Date | null {
  if (!estado.exigirNovaTaxaApos) return null;
  const data = new Date(estado.exigirNovaTaxaApos);
  return Number.isNaN(data.getTime()) ? null : data;
}

async function listarCobrancasDoCiclo(empresaId: string, estado: EstadoTaxaAbertura) {
  const corte = corteNovaTaxa(estado);
  return prisma.cobrancaAssinatura.findMany({
    where: {
      empresaId,
      plano: PLANO_TAXA_ABERTURA_SUBCONTA,
      ...(corte ? { createdAt: { gt: corte } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

function cobrancaPaga(cobranca: { provedor: string; statusAsaas: string; pagoEm: Date | null }) {
  return Boolean(cobranca.pagoEm) || statusCobrancaAssinaturaPago(cobranca.provedor, cobranca.statusAsaas);
}

export async function taxaAberturaSubcontaPaga(empresaId: string) {
  const estado = await lerEstado(empresaId);
  const cobrancas = await listarCobrancasDoCiclo(empresaId, estado);
  return cobrancas.some((cobranca) => cobrancaPaga(cobranca));
}

export async function marcarCadastroSubcontaAberto(
  empresaId: string,
  onboardingUrl?: string | null,
  onboardingUrlExpiraEm?: string | null
) {
  const estado = await lerEstado(empresaId);
  const informada = onboardingUrl?.trim() || "";
  const url =
    (informada && urlOnboardingAsaasPermitida(informada) ? informada : null) ||
    estado.onboardingUrl ||
    null;
  await gravarEstado(empresaId, {
    ...estado,
    cadastroAbertoEm: estado.cadastroAbertoEm || new Date().toISOString(),
    onboardingUrl: url,
    onboardingUrlExpiraEm: onboardingUrlExpiraEm || estado.onboardingUrlExpiraEm || null,
  });
}

/** Cancelou a subconta: a próxima abertura é outra conta e o Asaas cobra de novo. */
export async function exigirNovaTaxaAberturaSubconta(empresaId: string) {
  const estado = await lerEstado(empresaId);
  await gravarEstado(empresaId, {
    ...estado,
    exigirNovaTaxaApos: new Date().toISOString(),
    cadastroAbertoEm: null,
    onboardingUrl: null,
    onboardingUrlExpiraEm: null,
  });
}

async function imagemPix(paymentId: string, payloadSalvo: string | null) {
  try {
    const pix = await obterPixMercadoPagoPlataforma(paymentId);
    return {
      pixPayload: pix.pixPayload || payloadSalvo,
      pixEncodedImage: pix.pixEncodedImage,
      status: pix.status,
      pagoEm: pix.pagoEm,
    };
  } catch {
    return {
      pixPayload: payloadSalvo,
      pixEncodedImage: null,
      status: null as string | null,
      pagoEm: null as Date | null,
    };
  }
}

function montarCobrancaPublica(
  cobranca: {
    id: string;
    asaasPaymentId: string;
    pixPayload: string | null;
    pixExpiraEm: Date | null;
    pagoEm: Date | null;
    provedor: string;
    statusAsaas: string;
  },
  pixEncodedImage: string | null,
  pixPayload: string | null
) {
  const paga = cobrancaPaga(cobranca);
  return {
    cobrancaId: cobranca.id,
    paymentId: cobranca.asaasPaymentId,
    pixPayload: pixPayload || cobranca.pixPayload,
    pixEncodedImage,
    pixExpiraEm: cobranca.pixExpiraEm?.toISOString() ?? null,
    pago: paga,
  };
}

export async function resumoTaxaAberturaSubconta(
  empresaId: string
): Promise<ResumoTaxaAberturaSubconta> {
  const estado = await lerEstado(empresaId);
  const cobrancas = await listarCobrancasDoCiclo(empresaId, estado);
  const paga = cobrancas.find((cobranca) => cobrancaPaga(cobranca)) || null;
  const aberta =
    cobrancas.find((cobranca) =>
      cobrancaAssinaturaPixAberta({
        provedor: cobranca.provedor,
        statusAsaas: cobranca.statusAsaas,
        pixExpiraEm: cobranca.pixExpiraEm,
        createdAt: cobranca.createdAt,
        pagoEm: cobranca.pagoEm,
      })
    ) || null;
  const escolhida = paga || aberta;
  const url =
    estado.onboardingUrl && onboardingUrlAindaValida(estado.onboardingUrlExpiraEm)
      ? estado.onboardingUrl
      : null;

  return {
    valor: VALOR_TAXA_ABERTURA_SUBCONTA,
    valorFormatado: VALOR_TAXA_ABERTURA_SUBCONTA_FORMATADO,
    paga: Boolean(paga),
    cadastroAberto: Boolean(estado.cadastroAbertoEm),
    onboardingUrl: url,
    onboardingUrlExpiraEm: url ? estado.onboardingUrlExpiraEm || null : null,
    cobranca: escolhida
      ? montarCobrancaPublica(escolhida, null, escolhida.pixPayload)
      : null,
  };
}

export async function gerarOuReusarPixTaxaAberturaSubconta(
  empresaId: string,
  emailPagador?: string | null
): Promise<ResumoTaxaAberturaSubconta> {
  if (!mercadoPagoPlataformaConfigurado()) {
    throw new Error(
      "PIX da taxa indisponível. Configure o Mercado Pago usado na assinatura (MP_PLATAFORMA_ACCESS_TOKEN)."
    );
  }

  const estado = await lerEstado(empresaId);
  const cobrancas = await listarCobrancasDoCiclo(empresaId, estado);
  const paga = cobrancas.find((cobranca) => cobrancaPaga(cobranca));
  if (paga) {
    const atual = await resumoTaxaAberturaSubconta(empresaId);
    return { ...atual, paga: true };
  }

  const aberta = cobrancas.find((cobranca) =>
    cobrancaAssinaturaPixAberta({
      provedor: cobranca.provedor,
      statusAsaas: cobranca.statusAsaas,
      pixExpiraEm: cobranca.pixExpiraEm,
      createdAt: cobranca.createdAt,
      pagoEm: cobranca.pagoEm,
    })
  );

  if (aberta) {
    const pix = await imagemPix(aberta.asaasPaymentId, aberta.pixPayload);
    const base = await resumoTaxaAberturaSubconta(empresaId);
    return {
      ...base,
      paga: false,
      cobranca: montarCobrancaPublica(aberta, pix.pixEncodedImage, pix.pixPayload),
    };
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, nome: true, slug: true, cnpj: true, email: true },
  });
  if (!empresa) throw new Error("Laboratório não encontrado.");

  const pagamento = await criarPixAssinaturaMercadoPago({
    empresaId: empresa.id,
    empresaNome: empresa.nome,
    empresaSlug: empresa.slug,
    cnpj: empresa.cnpj,
    email: empresa.email,
    emailUsuario: emailPagador,
    valor: VALOR_TAXA_ABERTURA_SUBCONTA,
    descricao: `Taxa única de abertura da conta digital — ${empresa.nome}`,
    metadataTipo: PLANO_TAXA_ABERTURA_SUBCONTA,
    idempotencyKey: `taxa-subconta-${empresa.id}-${Date.now()}`,
  });

  const cobranca = await prisma.cobrancaAssinatura.create({
    data: {
      empresaId: empresa.id,
      asaasPaymentId: pagamento.paymentId,
      provedor: "mercadopago",
      plano: PLANO_TAXA_ABERTURA_SUBCONTA,
      valor: VALOR_TAXA_ABERTURA_SUBCONTA,
      diasRenovacao: 0,
      statusAsaas: pagamento.status,
      pixPayload: pagamento.pixPayload,
      pixExpiraEm: pagamento.pixExpiraEm ? new Date(pagamento.pixExpiraEm) : null,
    },
  });

  const base = await resumoTaxaAberturaSubconta(empresaId);
  return {
    ...base,
    paga: false,
    cobranca: montarCobrancaPublica(
      cobranca,
      pagamento.pixEncodedImage,
      pagamento.pixPayload
    ),
  };
}
