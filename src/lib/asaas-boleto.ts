import { prisma } from "@/lib/db";
import {
  cpfCnpjValido,
  criarOuBuscarClienteAsaas,
  emitirBoletoAsaas,
} from "@/lib/asaas-client";
import { asaasConfigurado } from "@/lib/asaas-config";
import { resolverContaDigitalOperacional } from "@/lib/asaas-conta-digital";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import { descricaoPublicaLancamento } from "@/lib/lancamento-despesa";
import { cobrancaPorLancamentoId } from "@/lib/lancamentos-cobranca";
import { empacotarReceitaConta, RECEITA_CONTA_SEP } from "@/lib/receita-conta-bancaria";
import { obterPadraoBoletoAsaas } from "@/lib/asaas-boleto-padrao";

function formaEhBoleto(forma?: string | null): boolean {
  return (forma || "").toLowerCase().includes("boleto");
}

/** Valida cliente/config antes de criar lançamento que exige boleto Asaas. */
export async function validarPreRequisitosBoletoAsaas(params: {
  empresaId: string;
  clienteId?: string | null;
}) {
  const { config } = await resolverContaDigitalOperacional(params.empresaId);
  if (!config || !asaasConfigurado(config)) {
    throw new Error(
      "Configure a chave da API Asaas em Configurações → Boletos ou conclua a subconta BaaS."
    );
  }
  if (!params.clienteId) {
    throw new Error("Selecione um cliente para emitir boleto.");
  }
  const cliente = await prisma.cliente.findFirst({
    where: { id: params.clienteId, empresaId: params.empresaId },
    select: { id: true, nome: true, cnpjCpf: true },
  });
  if (!cliente) {
    throw new Error("Cliente não encontrado.");
  }
  const doc = cliente.cnpjCpf?.trim() || "";
  if (!cpfCnpjValido(doc)) {
    throw new Error(
      `Cadastre CPF ou CNPJ válido do cliente "${cliente.nome}" antes de emitir boleto.`
    );
  }
  return { config, cliente, doc };
}

export async function tentarEmitirBoletoParaLancamento(
  lancamentoId: string,
  valorOverride?: number,
  opcoes?: { interest?: number | null; fine?: number | null }
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

  const { config, cliente, doc } = await validarPreRequisitosBoletoAsaas({
    empresaId: lancamento.empresaId,
    clienteId: lancamento.clienteId,
  });

  const padrao = await obterPadraoBoletoAsaas(lancamento.empresaId);
  const interest =
    opcoes?.interest != null
      ? opcoes.interest
      : padrao.cadastrado
        ? padrao.interest
        : 0;
  const fine =
    opcoes?.fine != null ? opcoes.fine : padrao.cadastrado ? padrao.fine : 0;

  const asaasCustomerId = await criarOuBuscarClienteAsaas({
    config,
    clienteId: cliente.id,
    nome: cliente.nome,
    cpfCnpj: doc,
    email: lancamento.cliente?.email,
    telefone: lancamento.cliente?.telefone,
    celular: lancamento.cliente?.celular,
  });

  const pagamento = await emitirBoletoAsaas({
    config,
    asaasCustomerId,
    valor: valorOverride ?? lancamento.valor,
    vencimento: lancamento.data,
    descricao: descricaoPublicaLancamento(lancamento.descricao),
    interest,
    fine,
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
  statusAsaas: string,
  pagoEm?: Date | null
) {
  const cobranca = await prisma.cobrancaAsaas.findUnique({
    where: { asaasPaymentId },
    include: { lancamento: true },
  });
  if (!cobranca) return;

  const statusNorm = (statusAsaas || "").toUpperCase();

  await prisma.cobrancaAsaas.update({
    where: { id: cobranca.id },
    data: { statusAsaas: statusNorm || statusAsaas },
  });

  if (statusNorm === "DELETED" || statusNorm === "REFUNDED") {
    const lancamento = cobranca.lancamento;
    if (
      lancamento.status !== "pago" &&
      lancamento.status !== "cancelado"
    ) {
      await prisma.lancamento.update({
        where: { id: lancamento.id },
        data: { status: "cancelado" },
      });
      invalidarCachePainelFinanceiro(lancamento.empresaId);
    }
    return;
  }

  const pago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(statusNorm);
  if (!pago) return;

  const lancamento = cobranca.lancamento;
  const dataPagamento =
    pagoEm && !Number.isNaN(pagoEm.getTime()) ? pagoEm : new Date();

  // Já quitado: ainda reforça data/conta se o webhook atrasou vs UI.
  const precisaMarcarPago = lancamento.status !== "pago";
  const precisaConta = !lancamento.descricao.includes(RECEITA_CONTA_SEP);
  if (!precisaMarcarPago && !precisaConta) {
    return;
  }

  const descricaoAtualizada = precisaConta
    ? empacotarReceitaConta(lancamento.descricao, "Conta Bancária")
    : lancamento.descricao;

  const atualizado = await prisma.lancamento.update({
    where: { id: cobranca.lancamentoId },
    data: {
      ...(precisaMarcarPago ? { status: "pago" as const } : {}),
      data: dataPagamento,
      descricao: descricaoAtualizada,
    },
  });

  if (atualizado.tipo === "receita" && atualizado.status === "pago") {
    const { sincronizarMovimentacaoRecebimentoServidor } = await import(
      "@/lib/recebimento-conta-bancaria-servidor"
    );
    await sincronizarMovimentacaoRecebimentoServidor(atualizado.empresaId, atualizado);
  }

  invalidarCachePainelFinanceiro(atualizado.empresaId);
}
