import { prisma } from "@/lib/db";
import {
  cpfCnpjValido,
  criarOuBuscarClienteAsaas,
  emitirPixCobrancaAsaas,
  obterQrCodePixAsaas,
} from "@/lib/asaas-client";
import { formaEhPixAsaas } from "@/lib/forma-pagamento-pix";
import { cobrancaPorLancamentoId } from "@/lib/lancamentos-cobranca";
import { configOperacionalSubconta } from "@/lib/asaas-subconta";
import { descricaoPublicaLancamento } from "@/lib/lancamento-despesa";

export type PixCobrancaEmitida = {
  cobrancaId: string;
  paymentId: string;
  pixPayload: string;
  pixEncodedImage: string;
  expirationDate?: string;
};

export async function subcontaPixAsaasDisponivel(empresaId: string) {
  const config = await configOperacionalSubconta(empresaId);
  return Boolean(config);
}

export async function tentarEmitirPixParaLancamento(
  lancamentoId: string,
  valorOverride?: number
): Promise<PixCobrancaEmitida | null> {
  const lancamento = await prisma.lancamento.findUnique({
    where: { id: lancamentoId },
    include: { cliente: true },
  });

  if (!lancamento) throw new Error("Lançamento não encontrado.");
  if (lancamento.tipo !== "receita") {
    throw new Error("Pix só pode ser emitido para receitas.");
  }
  if (!formaEhPixAsaas(lancamento.formaPagamento)) {
    return null;
  }

  const cobrancaExistente = await cobrancaPorLancamentoId(lancamentoId);
  if (cobrancaExistente?.asaasPaymentId) {
    const config = await configOperacionalSubconta(lancamento.empresaId);
    if (!config) {
      throw new Error("Subconta Asaas não aprovada para emitir Pix.");
    }
    const qr = await obterQrCodePixAsaas(config, cobrancaExistente.asaasPaymentId);
    return {
      cobrancaId: cobrancaExistente.id,
      paymentId: cobrancaExistente.asaasPaymentId,
      pixPayload: qr.payload,
      pixEncodedImage: qr.encodedImage,
      expirationDate: qr.expirationDate,
    };
  }

  const config = await configOperacionalSubconta(lancamento.empresaId);
  if (!config) {
    throw new Error(
      "Pix com QR Code exige subconta Asaas aprovada. Conclua a abertura em Configurações → Boletos ou use Pix Externo."
    );
  }

  if (!lancamento.clienteId || !lancamento.cliente) {
    throw new Error("Selecione um cliente para emitir Pix.");
  }

  const doc = lancamento.cliente.cnpjCpf?.trim() || "";
  if (!cpfCnpjValido(doc)) {
    throw new Error(
      `Cadastre CPF ou CNPJ válido do cliente "${lancamento.cliente.nome}" antes de emitir Pix.`
    );
  }

  const valor = valorOverride ?? lancamento.valor;
  if (valor <= 0) throw new Error("Valor do Pix deve ser maior que zero.");

  const asaasCustomerId = await criarOuBuscarClienteAsaas({
    config,
    clienteId: lancamento.cliente.id,
    nome: lancamento.cliente.nome,
    cpfCnpj: doc,
    email: lancamento.cliente.email,
    telefone: lancamento.cliente.telefone,
    celular: lancamento.cliente.celular,
  });

  const pagamento = await emitirPixCobrancaAsaas({
    config,
    asaasCustomerId,
    valor,
    vencimento: lancamento.data,
    descricao: descricaoPublicaLancamento(lancamento.descricao),
  });

  const qr = await obterQrCodePixAsaas(config, pagamento.id);

  const cobranca = await prisma.cobrancaAsaas.create({
    data: {
      lancamentoId: lancamento.id,
      asaasPaymentId: pagamento.id,
      linhaDigitavel: qr.payload,
      statusAsaas: pagamento.status || "PENDING",
    },
  });

  return {
    cobrancaId: cobranca.id,
    paymentId: pagamento.id,
    pixPayload: qr.payload,
    pixEncodedImage: qr.encodedImage,
    expirationDate: qr.expirationDate,
  };
}

export async function emitirPixCobrancaRecebimento(params: {
  empresaId: string;
  clienteId: string;
  valor: number;
  descricao: string;
  vencimento?: Date;
  lancamentoId?: string;
}): Promise<PixCobrancaEmitida> {
  const config = await configOperacionalSubconta(params.empresaId);
  if (!config) {
    throw new Error(
      "Pix com QR Code exige subconta Asaas aprovada. Conclua a abertura em Configurações → Boletos ou use Pix Externo."
    );
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: params.clienteId, empresaId: params.empresaId },
  });
  if (!cliente) throw new Error("Cliente não encontrado.");

  const doc = cliente.cnpjCpf?.trim() || "";
  if (!cpfCnpjValido(doc)) {
    throw new Error(
      `Cadastre CPF ou CNPJ válido do cliente "${cliente.nome}" antes de emitir Pix.`
    );
  }

  if (params.valor <= 0) throw new Error("Valor do Pix deve ser maior que zero.");

  let lancamentoId = params.lancamentoId;
  if (!lancamentoId) {
    const criado = await prisma.lancamento.create({
      data: {
        empresaId: params.empresaId,
        tipo: "receita",
        descricao: params.descricao,
        valor: params.valor,
        data: params.vencimento ?? new Date(),
        status: "pendente",
        formaPagamento: "Pix",
        clienteId: params.clienteId,
      },
    });
    lancamentoId = criado.id;
  }

  const existente = await cobrancaPorLancamentoId(lancamentoId);
  if (existente?.asaasPaymentId) {
    const qr = await obterQrCodePixAsaas(config, existente.asaasPaymentId);
    return {
      cobrancaId: existente.id,
      paymentId: existente.asaasPaymentId,
      pixPayload: qr.payload,
      pixEncodedImage: qr.encodedImage,
      expirationDate: qr.expirationDate,
    };
  }

  const asaasCustomerId = await criarOuBuscarClienteAsaas({
    config,
    clienteId: cliente.id,
    nome: cliente.nome,
    cpfCnpj: doc,
    email: cliente.email,
    telefone: cliente.telefone,
    celular: cliente.celular,
  });

  const pagamento = await emitirPixCobrancaAsaas({
    config,
    asaasCustomerId,
    valor: params.valor,
    vencimento: params.vencimento ?? new Date(),
    descricao: descricaoPublicaLancamento(params.descricao),
  });

  const qr = await obterQrCodePixAsaas(config, pagamento.id);

  const cobranca = await prisma.cobrancaAsaas.create({
    data: {
      lancamentoId,
      asaasPaymentId: pagamento.id,
      linhaDigitavel: qr.payload,
      statusAsaas: pagamento.status || "PENDING",
    },
  });

  return {
    cobrancaId: cobranca.id,
    paymentId: pagamento.id,
    pixPayload: qr.payload,
    pixEncodedImage: qr.encodedImage,
    expirationDate: qr.expirationDate,
  };
}
