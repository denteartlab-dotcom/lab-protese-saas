import {
  calcularRenovacaoAssinaturaEmpilhada,
  formatarDataAssinatura,
} from "@/lib/assinatura-empresa";
import {
  resolverProvedorPixAssinatura,
  statusCobrancaAssinaturaPago,
  cobrancaAssinaturaPixAberta,
  type ProvedorPixAssinatura,
} from "@/lib/assinatura-pix-provedor";
import {
  criarOuBuscarClientePlataformaAsaas,
  emitirPixAssinaturaPlataforma,
  obterPagamentoPlataforma,
  obterQrCodePixPlataforma,
} from "@/lib/asaas-plataforma";
import {
  criarPixAssinaturaMercadoPago,
  obterPagamentoMercadoPagoPlataforma,
  obterPixMercadoPagoPlataforma,
} from "@/lib/mercadopago-plataforma";
import { prisma } from "@/lib/db";
import { PIX_ASSINATURA_QR_EXPIRACAO_MS } from "@/lib/assinatura-pix-constants";
import {
  diasRenovacaoPlano,
  limitesDoPlano,
  normalizarPeriodoCobranca,
  normalizarPlanoEmpresa,
  precoPlano,
  rotuloPeriodoCobranca,
  rotuloPlanoEmpresa,
} from "@/lib/master-planos";

export type CobrancaPixAssinatura = {
  cobrancaId: string;
  paymentId: string;
  provedor: ProvedorPixAssinatura;
  valor: number;
  valorFormatado: string;
  plano: string;
  planoRotulo: string;
  periodoCobranca: string;
  periodoRotulo: string;
  diasRenovacao: number;
  statusAsaas: string;
  pixPayload: string | null;
  pixEncodedImage: string | null;
  pixExpiraEm: string | null;
  pago: boolean;
  renovadoEm: string | null;
  novaDataVencimento: string | null;
  empresaSlug: string | null;
};

function cobrancaPendenteValida(cobranca: {
  provedor: string;
  statusAsaas: string;
  pixExpiraEm: Date | null;
  createdAt: Date;
  pagoEm?: Date | null;
}): boolean {
  return cobrancaAssinaturaPixAberta(cobranca);
}

function cobrancaPendenteReutilizavel(
  cobranca: {
    valor: number;
    diasRenovacao: number;
    provedor: string;
    statusAsaas: string;
    pixExpiraEm: Date | null;
    createdAt: Date;
    pagoEm?: Date | null;
  },
  plano: string,
  periodo: string
): boolean {
  if (!cobrancaPendenteValida(cobranca)) return false;
  if (cobranca.valor !== precoPlano(plano, periodo)) return false;
  if (cobranca.diasRenovacao !== diasRenovacaoPlano(periodo)) return false;
  if (cobranca.pixExpiraEm) {
    const duracaoMs =
      cobranca.pixExpiraEm.getTime() - cobranca.createdAt.getTime();
    if (duracaoMs > PIX_ASSINATURA_QR_EXPIRACAO_MS + 2 * 60 * 1000) {
      return false;
    }
    const restanteMs = cobranca.pixExpiraEm.getTime() - Date.now();
    if (restanteMs > PIX_ASSINATURA_QR_EXPIRACAO_MS + 60 * 1000) {
      return false;
    }
  }
  return true;
}

async function montarRespostaCobranca(
  cobranca: {
    id: string;
    asaasPaymentId: string;
    provedor: string;
    plano: string;
    valor: number;
    diasRenovacao: number;
    statusAsaas: string;
    pixPayload: string | null;
    pixExpiraEm: Date | null;
    pagoEm: Date | null;
    renovadoEm: Date | null;
    empresa: { dataVencimento: Date | null; slug: string };
  },
  pixEncodedImage?: string | null
): Promise<CobrancaPixAssinatura> {
  const provedor = (cobranca.provedor === "asaas" ? "asaas" : "mercadopago") as ProvedorPixAssinatura;
  const pago =
    statusCobrancaAssinaturaPago(provedor, cobranca.statusAsaas) ||
    Boolean(cobranca.pagoEm) ||
    Boolean(cobranca.renovadoEm);
  const periodoCobranca =
    cobranca.diasRenovacao >= 360 ? "anual" : "mensal";
  return {
    cobrancaId: cobranca.id,
    paymentId: cobranca.asaasPaymentId,
    provedor,
    valor: cobranca.valor,
    valorFormatado: cobranca.valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }),
    plano: cobranca.plano,
    planoRotulo: rotuloPlanoEmpresa(cobranca.plano),
    periodoCobranca,
    periodoRotulo: rotuloPeriodoCobranca(periodoCobranca),
    diasRenovacao: cobranca.diasRenovacao,
    statusAsaas: cobranca.statusAsaas,
    pixPayload: cobranca.pixPayload,
    pixEncodedImage: pixEncodedImage ?? null,
    pixExpiraEm: cobranca.pixExpiraEm?.toISOString() ?? null,
    pago,
    renovadoEm: cobranca.renovadoEm?.toISOString() ?? null,
    novaDataVencimento: cobranca.empresa.dataVencimento?.toISOString() ?? null,
    empresaSlug: cobranca.empresa.slug,
  };
}

async function gerarCobrancaMercadoPago(
  empresa: {
    id: string;
    nome: string;
    slug: string;
    plano: string;
    cnpj: string | null;
    email: string | null;
    dataVencimento: Date | null;
  },
  valor: number,
  planoCobranca: string,
  diasRenovacao: number,
  emailPagador?: string | null
): Promise<CobrancaPixAssinatura> {
  const descricao = `Renovação ${rotuloPeriodoCobranca(diasRenovacao >= 360 ? "anual" : "mensal").toLowerCase()} ${rotuloPlanoEmpresa(planoCobranca)} — ${empresa.nome}`;
  const pagamento = await criarPixAssinaturaMercadoPago({
    empresaId: empresa.id,
    empresaNome: empresa.nome,
    empresaSlug: empresa.slug,
    cnpj: empresa.cnpj,
    email: empresa.email,
    emailUsuario: emailPagador,
    valor,
    descricao,
  });

  const cobranca = await prisma.cobrancaAssinatura.create({
    data: {
      empresaId: empresa.id,
      asaasPaymentId: pagamento.paymentId,
      provedor: "mercadopago",
      plano: planoCobranca,
      valor,
      diasRenovacao,
      statusAsaas: pagamento.status,
      pixPayload: pagamento.pixPayload,
      pixExpiraEm: pagamento.pixExpiraEm ? new Date(pagamento.pixExpiraEm) : null,
    },
    include: { empresa: { select: { dataVencimento: true, slug: true } } },
  });

  return montarRespostaCobranca(cobranca, pagamento.pixEncodedImage);
}

async function gerarCobrancaAsaas(
  empresa: {
    id: string;
    nome: string;
    plano: string;
    cnpj: string | null;
    email: string | null;
    telefone: string | null;
    whatsapp: string | null;
    dataVencimento: Date | null;
    asaasCustomerIdPlataforma: string | null;
  },
  valor: number,
  planoCobranca: string,
  diasRenovacao: number
): Promise<CobrancaPixAssinatura> {
  const asaasCustomerId = await criarOuBuscarClientePlataformaAsaas(empresa);
  const descricao = `Renovação ${rotuloPeriodoCobranca(diasRenovacao >= 360 ? "anual" : "mensal").toLowerCase()} ${rotuloPlanoEmpresa(planoCobranca)} — ${empresa.nome}`;
  const pagamento = await emitirPixAssinaturaPlataforma({
    asaasCustomerId,
    valor,
    descricao,
  });
  const qr = await obterQrCodePixPlataforma(pagamento.id);

  const cobranca = await prisma.cobrancaAssinatura.create({
    data: {
      empresaId: empresa.id,
      asaasPaymentId: pagamento.id,
      provedor: "asaas",
      plano: planoCobranca,
      valor,
      diasRenovacao,
      statusAsaas: pagamento.status || "PENDING",
      pixPayload: qr.payload || null,
      pixExpiraEm: qr.expirationDate ? new Date(qr.expirationDate) : null,
    },
    include: { empresa: { select: { dataVencimento: true, slug: true } } },
  });

  return montarRespostaCobranca(cobranca, qr.encodedImage || null);
}

export async function gerarCobrancaPixRenovacao(
  empresaId: string,
  planoEscolhido?: string,
  opcoes?: {
    emailPagador?: string | null;
    forcarNova?: boolean;
    periodo?: string;
  }
): Promise<CobrancaPixAssinatura> {
  const provedor = resolverProvedorPixAssinatura();
  if (!provedor) {
    throw new Error(
      "Renovação por PIX não configurada. Configure MP_PLATAFORMA_ACCESS_TOKEN no servidor."
    );
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nome: true,
      slug: true,
      plano: true,
      cnpj: true,
      email: true,
      telefone: true,
      whatsapp: true,
      dataVencimento: true,
      asaasCustomerIdPlataforma: true,
    },
  });
  if (!empresa) throw new Error("Laboratório não encontrado.");

  let emailPagador = opcoes?.emailPagador;
  if (!emailPagador) {
    const usuario = await prisma.user.findFirst({
      where: {
        empresaId,
        excluidoEm: null,
        role: { in: ["proprietario", "admin", "admin_empresa"] },
      },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });
    emailPagador = usuario?.email ?? null;
  }

  const plano = normalizarPlanoEmpresa(planoEscolhido || empresa.plano);
  const periodo = normalizarPeriodoCobranca(opcoes?.periodo || "mensal");
  const valor = precoPlano(plano, periodo);
  const diasRenovacao = diasRenovacaoPlano(periodo);

  const pendente = await prisma.cobrancaAssinatura.findFirst({
    where: {
      empresaId,
      provedor,
      plano,
      valor,
      diasRenovacao,
      statusAsaas: provedor === "mercadopago" ? { in: ["pending", "in_process", "PENDING"] } : "PENDING",
    },
    orderBy: { createdAt: "desc" },
    include: { empresa: { select: { dataVencimento: true, slug: true } } },
  });

  if (pendente && !opcoes?.forcarNova && cobrancaPendenteReutilizavel(pendente, plano, periodo)) {
    let encodedImage: string | null = null;
    if (pendente.provedor === "asaas") {
      try {
        const qr = await obterQrCodePixPlataforma(pendente.asaasPaymentId);
        encodedImage = qr.encodedImage || null;
        if (qr.payload && qr.payload !== pendente.pixPayload) {
          await prisma.cobrancaAssinatura.update({
            where: { id: pendente.id },
            data: {
              pixPayload: qr.payload,
              pixExpiraEm: qr.expirationDate ? new Date(qr.expirationDate) : pendente.pixExpiraEm,
            },
          });
          pendente.pixPayload = qr.payload;
        }
      } catch {
        /* mantém payload salvo */
      }
    } else if (pendente.provedor === "mercadopago") {
      try {
        const pix = await obterPixMercadoPagoPlataforma(pendente.asaasPaymentId);
        encodedImage = pix.pixEncodedImage;
      } catch {
        /* mantém payload salvo */
      }
    }
    return montarRespostaCobranca(pendente, encodedImage);
  }

  if (provedor === "mercadopago") {
    return gerarCobrancaMercadoPago(
      empresa,
      valor,
      plano,
      diasRenovacao,
      emailPagador
    );
  }
  return gerarCobrancaAsaas(empresa, valor, plano, diasRenovacao);
}

export async function consultarCobrancaPixAssinatura(
  cobrancaId: string,
  empresaId?: string
): Promise<CobrancaPixAssinatura | null> {
  const cobranca = await prisma.cobrancaAssinatura.findFirst({
    where: {
      id: cobrancaId,
      ...(empresaId ? { empresaId } : {}),
    },
    include: { empresa: { select: { dataVencimento: true, slug: true } } },
  });
  if (!cobranca) return null;

  let encodedImage: string | null = null;
  if (
    cobranca.provedor === "mercadopago" &&
    !statusCobrancaAssinaturaPago("mercadopago", cobranca.statusAsaas)
  ) {
    try {
      const pix = await obterPixMercadoPagoPlataforma(cobranca.asaasPaymentId);
      encodedImage = pix.pixEncodedImage;
    } catch {
      /* mantém só o copia e cola salvo */
    }
  }

  return montarRespostaCobranca(cobranca, encodedImage);
}

export async function sincronizarStatusPagamentoAssinatura(
  paymentId: string,
  provedor?: string
): Promise<{ renovado: boolean; empresaId?: string; dataVencimento?: string }> {
  const cobranca = await prisma.cobrancaAssinatura.findUnique({
    where: { asaasPaymentId: paymentId },
    include: { empresa: { select: { id: true, nome: true, dataVencimento: true } } },
  });
  if (!cobranca) return { renovado: false };

  const prov = provedor || cobranca.provedor;
  let status = cobranca.statusAsaas;
  let pagoEm: Date | null = null;

  try {
    if (prov === "mercadopago") {
      const pagamento = await obterPagamentoMercadoPagoPlataforma(paymentId);
      status = pagamento.status;
      pagoEm = pagamento.pagoEm;
    } else {
      const pagamento = await obterPagamentoPlataforma(paymentId);
      status = pagamento.status;
    }
  } catch {
    /* usa status atual */
  }

  return sincronizarPagamentoAssinatura(paymentId, status, pagoEm);
}

export async function aplicarRenovacaoAssinaturaPorPagamento(
  empresaId: string,
  diasRenovacao: number,
  plano?: string
): Promise<Date> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { dataVencimento: true, plano: true },
  });
  if (!empresa) throw new Error("Empresa não encontrada.");

  const planoFinal = normalizarPlanoEmpresa(plano || empresa.plano);
  const limites = limitesDoPlano(planoFinal);

  const dataVencimento = calcularRenovacaoAssinaturaEmpilhada(
    empresa.dataVencimento,
    diasRenovacao
  );

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      status: "ativo",
      dataVencimento,
      plano: planoFinal,
      limiteUsuarios: limites.usuarios,
      limiteTrabalhos: limites.trabalhos,
    },
  });

  return dataVencimento;
}

export async function sincronizarPagamentoAssinatura(
  paymentId: string,
  statusPagamento: string,
  pagoEmInformado?: Date | null
): Promise<{ renovado: boolean; empresaId?: string; dataVencimento?: string }> {
  const cobranca = await prisma.cobrancaAssinatura.findUnique({
    where: { asaasPaymentId: paymentId },
    include: { empresa: { select: { id: true, nome: true, dataVencimento: true } } },
  });
  if (!cobranca) return { renovado: false };

  const pago = statusCobrancaAssinaturaPago(cobranca.provedor, statusPagamento);
  const pagoEmFinal =
    pago && !cobranca.pagoEm
      ? pagoEmInformado && !Number.isNaN(pagoEmInformado.getTime())
        ? pagoEmInformado
        : new Date()
      : null;

  await prisma.cobrancaAssinatura.update({
    where: { id: cobranca.id },
    data: {
      statusAsaas: statusPagamento,
      ...(pagoEmFinal ? { pagoEm: pagoEmFinal } : {}),
    },
  });

  if (!pago || cobranca.renovadoEm) {
    return { renovado: false, empresaId: cobranca.empresaId };
  }

  const reservaRenovacao = await prisma.cobrancaAssinatura.updateMany({
    where: { id: cobranca.id, renovadoEm: null },
    data: {
      renovadoEm: new Date(),
      ...(pagoEmFinal && !cobranca.pagoEm ? { pagoEm: pagoEmFinal } : {}),
    },
  });

  if (reservaRenovacao.count === 0) {
    return { renovado: false, empresaId: cobranca.empresaId };
  }

  const novaData = await aplicarRenovacaoAssinaturaPorPagamento(
    cobranca.empresaId,
    cobranca.diasRenovacao,
    cobranca.plano
  );

  console.log(
    `[assinatura-pix/${cobranca.provedor}] Renovação automática: ${cobranca.empresa.nome} até ${formatarDataAssinatura(novaData)}`
  );

  return {
    renovado: true,
    empresaId: cobranca.empresaId,
    dataVencimento: novaData.toISOString(),
  };
}

export async function resolverEmpresaIdParaRenovacao(params: {
  sessionEmpresaId?: string | null;
  email?: string;
  password?: string;
  empresaSlug?: string;
}): Promise<string> {
  if (params.sessionEmpresaId) return params.sessionEmpresaId;

  const email = params.email?.trim().toLowerCase();
  const password = params.password || "";
  const empresaSlug = params.empresaSlug?.trim().toLowerCase();

  if (!email || !password || !empresaSlug) {
    throw new Error("Informe e-mail, senha e laboratório para gerar o PIX.");
  }

  const { verifyPassword } = await import("@/lib/auth");
  const usuario = await prisma.user.findFirst({
    where: {
      email,
      excluidoEm: null,
      empresa: { slug: empresaSlug },
    },
    select: {
      password: true,
      empresaId: true,
    },
  });

  if (!usuario || !(await verifyPassword(password, usuario.password))) {
    throw new Error("E-mail ou senha inválidos.");
  }

  return usuario.empresaId;
}
