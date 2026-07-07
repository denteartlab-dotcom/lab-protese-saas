import { prisma } from "@/lib/db";
import {
  cpfCnpjValido,
  criarOuBuscarClienteAsaas,
  emitirBoletoAsaas,
  obterConfigAsaas,
} from "@/lib/asaas-client";
import { asaasConfigurado } from "@/lib/asaas-config";
import { descricaoPublicaLancamento } from "@/lib/lancamento-despesa";
import { cobrancaPorLancamentoId } from "@/lib/lancamentos-cobranca";

function formaEhBoleto(forma?: string | null): boolean {
  return (forma || "").toLowerCase().includes("boleto");
}

export async function tentarEmitirBoletoParaLancamento(
  lancamentoId: string,
  valorOverride?: number
) {
  const lancamento = await prisma.lancamento.findUnique({
    where: { id: lancamentoId },
    include: { cliente: true },
  });

  if (!lancamento) throw new Error("Lançamento não encontrado.");
  if (lancamento.tipo !== "receita") {
    throw new Error("Boleto só pode ser emitido para receitas.");
  }
  if (!formaEhBoleto(lancamento.formaPagamento)) {
    return null;
  }
  const cobrancaExistente = await cobrancaPorLancamentoId(lancamentoId);
  if (cobrancaExistente) {
    return cobrancaExistente;
  }

  const config = await obterConfigAsaas(lancamento.empresaId);
  if (!asaasConfigurado(config)) {
    throw new Error("Configure a chave da API Asaas em Configurações → Boletos.");
  }

  if (!lancamento.clienteId || !lancamento.cliente) {
    throw new Error("Selecione um cliente para emitir boleto.");
  }

  const doc = lancamento.cliente.cnpjCpf?.trim() || "";
  if (!cpfCnpjValido(doc)) {
    throw new Error(
      `Cadastre CPF ou CNPJ válido do cliente "${lancamento.cliente.nome}" antes de emitir boleto.`
    );
  }

  const asaasCustomerId = await criarOuBuscarClienteAsaas({
    config,
    clienteId: lancamento.cliente.id,
    nome: lancamento.cliente.nome,
    cpfCnpj: doc,
    email: lancamento.cliente.email,
    telefone: lancamento.cliente.telefone,
    celular: lancamento.cliente.celular,
  });

  const pagamento = await emitirBoletoAsaas({
    config,
    asaasCustomerId,
    valor: valorOverride ?? lancamento.valor,
    vencimento: lancamento.data,
    descricao: descricaoPublicaLancamento(lancamento.descricao),
  });

  return prisma.cobrancaAsaas.create({
    data: {
      lancamentoId: lancamento.id,
      asaasPaymentId: pagamento.id,
      bankSlipUrl: pagamento.bankSlipUrl || null,
      invoiceUrl: pagamento.invoiceUrl || null,
      linhaDigitavel: pagamento.identificationField || null,
      statusAsaas: pagamento.status || "PENDING",
    },
  });
}

export async function sincronizarPagamentoAsaas(
  asaasPaymentId: string,
  statusAsaas: string
) {
  const cobranca = await prisma.cobrancaAsaas.findUnique({
    where: { asaasPaymentId },
    include: { lancamento: true },
  });
  if (!cobranca) return;

  await prisma.cobrancaAsaas.update({
    where: { id: cobranca.id },
    data: { statusAsaas },
  });

  const pago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(statusAsaas);
  if (pago && cobranca.lancamento.status !== "pago") {
    const atualizado = await prisma.lancamento.update({
      where: { id: cobranca.lancamentoId },
      data: { status: "pago" },
    });
    if (atualizado.tipo === "receita") {
      const { sincronizarMovimentacaoRecebimentoServidor } = await import(
        "@/lib/recebimento-conta-bancaria-servidor"
      );
      await sincronizarMovimentacaoRecebimentoServidor(
        atualizado.empresaId,
        atualizado
      );
    }
  }
}
