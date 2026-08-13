import { prisma } from "@/lib/db";
import { resolverContaDigitalOperacional } from "@/lib/asaas-conta-digital";
import {
  atualizarCobrancaAsaas,
  cobrancaAsaasEditavel,
  cobrancaAsaasJaPaga,
  excluirCobrancaAsaas,
  listarCobrancasAsaas,
  obterCobrancaAsaas,
  type AsaasCobrancaDetalhe,
  type AtualizarCobrancaAsaasBody,
} from "@/lib/asaas-cobrancas";
import { sincronizarPagamentoAsaas } from "@/lib/asaas-boleto";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import { descricaoPublicaLancamento } from "@/lib/lancamento-despesa";
import type { AsaasConfig } from "@/lib/asaas-config";

export type BoletoAsaasListagem = {
  id: string;
  cobrancaId: string;
  lancamentoId: string;
  status: string;
  valor: number;
  vencimento: string;
  criadoEm: string;
  clienteId: string | null;
  clienteNome: string | null;
  numeroOs: string | number | null;
  descricao: string;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  linhaDigitavel: string | null;
  interest: number | null;
  fine: number | null;
  fineType: string | null;
  editavel: boolean;
};

export type FiltrosListagemBoletosAsaas = {
  status?: string;
  busca?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
  limit?: number;
};

async function configContaDigitalObrigatoria(empresaId: string): Promise<AsaasConfig> {
  const { config } = await resolverContaDigitalOperacional(empresaId);
  if (!config) {
    throw new Error(
      "Conta digital não está ativa. Configure a chave API em Configurações → Boletos ou conclua a subconta BaaS."
    );
  }
  return config;
}

function percentualDe(campo: AsaasCobrancaDetalhe["interest"] | AsaasCobrancaDetalhe["fine"]) {
  if (!campo || campo.value == null || !Number.isFinite(Number(campo.value))) return null;
  return Number(campo.value);
}

function mapearBoleto(params: {
  cobrancaId: string;
  lancamentoId: string;
  localStatus: string;
  valorLocal: number;
  dataLocal: Date;
  createdAt: Date;
  clienteId: string | null;
  clienteNome: string | null;
  numeroOs: string | number | null;
  descricao: string;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  linhaDigitavel: string | null;
  asaasPaymentId: string;
  remoto?: AsaasCobrancaDetalhe | null;
}): BoletoAsaasListagem {
  const remoto = params.remoto;
  const status = (remoto?.status || params.localStatus || "PENDING").toUpperCase();
  return {
    id: params.asaasPaymentId,
    cobrancaId: params.cobrancaId,
    lancamentoId: params.lancamentoId,
    status,
    valor: remoto?.value != null ? Number(remoto.value) : params.valorLocal,
    vencimento:
      remoto?.dueDate ||
      params.dataLocal.toISOString().slice(0, 10),
    criadoEm: params.createdAt.toISOString(),
    clienteId: params.clienteId,
    clienteNome: params.clienteNome,
    numeroOs: params.numeroOs,
    descricao: descricaoPublicaLancamento(params.descricao),
    bankSlipUrl: remoto?.bankSlipUrl || params.bankSlipUrl,
    invoiceUrl: remoto?.invoiceUrl || params.invoiceUrl,
    linhaDigitavel:
      remoto?.identificationField || params.linhaDigitavel,
    interest: percentualDe(remoto?.interest ?? null),
    fine: percentualDe(remoto?.fine ?? null),
    fineType: remoto?.fine?.type || null,
    editavel: cobrancaAsaasEditavel(status),
  };
}

export async function listarBoletosAsaasEmpresa(
  empresaId: string,
  filtros: FiltrosListagemBoletosAsaas = {}
): Promise<BoletoAsaasListagem[]> {
  const config = await configContaDigitalObrigatoria(empresaId);
  const limit = Math.min(Math.max(filtros.limit ?? 80, 1), 100);
  const statusFiltro = filtros.status?.trim().toUpperCase() || undefined;
  const busca = filtros.busca?.trim().toLowerCase() || "";

  const locais = await prisma.cobrancaAsaas.findMany({
    where: {
      ...(statusFiltro ? { statusAsaas: statusFiltro } : {}),
      lancamento: {
        empresaId,
        tipo: "receita",
        ...(busca
          ? {
              OR: [
                { descricao: { contains: busca, mode: "insensitive" } },
                { cliente: { nome: { contains: busca, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(filtros.vencimentoDe || filtros.vencimentoAte
          ? {
              data: {
                ...(filtros.vencimentoDe
                  ? { gte: new Date(`${filtros.vencimentoDe}T00:00:00.000Z`) }
                  : {}),
                ...(filtros.vencimentoAte
                  ? { lte: new Date(`${filtros.vencimentoAte}T23:59:59.999Z`) }
                  : {}),
              },
            }
          : {}),
      },
    },
    include: {
      lancamento: {
        include: {
          cliente: { select: { id: true, nome: true } },
          trabalho: { select: { numeroOs: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const remotoPorId = new Map<string, AsaasCobrancaDetalhe>();
  try {
    const remoto = await listarCobrancasAsaas(config, {
      billingType: "BOLETO",
      status: statusFiltro,
      dueDateGe: filtros.vencimentoDe,
      dueDateLe: filtros.vencimentoAte,
      limit: 100,
    });
    for (const item of remoto.data || []) {
      if (item.id) remotoPorId.set(item.id, item);
    }
  } catch {
    /* listagem local permanece útil sem enriquecimento Asaas */
  }

  return locais.map((c) =>
    mapearBoleto({
      cobrancaId: c.id,
      lancamentoId: c.lancamentoId,
      localStatus: c.statusAsaas,
      valorLocal: c.lancamento.valor,
      dataLocal: c.lancamento.data,
      createdAt: c.createdAt,
      clienteId: c.lancamento.clienteId,
      clienteNome: c.lancamento.cliente?.nome || null,
      numeroOs: c.lancamento.trabalho?.numeroOs ?? null,
      descricao: c.lancamento.descricao,
      bankSlipUrl: c.bankSlipUrl,
      invoiceUrl: c.invoiceUrl,
      linhaDigitavel: c.linhaDigitavel,
      asaasPaymentId: c.asaasPaymentId,
      remoto: remotoPorId.get(c.asaasPaymentId) || null,
    })
  );
}

export async function obterBoletoAsaasEmpresa(
  empresaId: string,
  asaasPaymentId: string
): Promise<BoletoAsaasListagem> {
  const config = await configContaDigitalObrigatoria(empresaId);
  const local = await prisma.cobrancaAsaas.findFirst({
    where: {
      asaasPaymentId,
      lancamento: { empresaId, tipo: "receita" },
    },
    include: {
      lancamento: {
        include: {
          cliente: { select: { id: true, nome: true } },
          trabalho: { select: { numeroOs: true } },
        },
      },
    },
  });
  if (!local) {
    throw new Error("Boleto não encontrado nesta empresa.");
  }

  let remoto: AsaasCobrancaDetalhe | null = null;
  try {
    remoto = await obterCobrancaAsaas(config, asaasPaymentId);
  } catch {
    remoto = null;
  }

  return mapearBoleto({
    cobrancaId: local.id,
    lancamentoId: local.lancamentoId,
    localStatus: local.statusAsaas,
    valorLocal: local.lancamento.valor,
    dataLocal: local.lancamento.data,
    createdAt: local.createdAt,
    clienteId: local.lancamento.clienteId,
    clienteNome: local.lancamento.cliente?.nome || null,
    numeroOs: local.lancamento.trabalho?.numeroOs ?? null,
    descricao: local.lancamento.descricao,
    bankSlipUrl: local.bankSlipUrl,
    invoiceUrl: local.invoiceUrl,
    linhaDigitavel: local.linhaDigitavel,
    asaasPaymentId: local.asaasPaymentId,
    remoto,
  });
}

export async function atualizarBoletoAsaasEmpresa(
  empresaId: string,
  asaasPaymentId: string,
  body: {
    dueDate?: string;
    interest?: number | null;
    fine?: number | null;
  }
): Promise<BoletoAsaasListagem> {
  const config = await configContaDigitalObrigatoria(empresaId);
  const local = await prisma.cobrancaAsaas.findFirst({
    where: {
      asaasPaymentId,
      lancamento: { empresaId, tipo: "receita" },
    },
  });
  if (!local) {
    throw new Error("Boleto não encontrado nesta empresa.");
  }

  const atual = await obterCobrancaAsaas(config, asaasPaymentId);
  if (cobrancaAsaasJaPaga(atual.status) || !cobrancaAsaasEditavel(atual.status)) {
    throw new Error(
      "Só é possível alterar boletos pendentes ou vencidos. Cobranças pagas ficam somente leitura."
    );
  }

  const payload: AtualizarCobrancaAsaasBody = {};
  if (body.dueDate?.trim()) {
    payload.dueDate = body.dueDate.trim().slice(0, 10);
  }
  if (body.interest !== undefined) {
    const value = body.interest == null ? 0 : Number(body.interest);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Informe um percentual de juros válido (>= 0).");
    }
    payload.interest = { value };
  }
  if (body.fine !== undefined) {
    const value = body.fine == null ? 0 : Number(body.fine);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Informe um percentual de multa válido (>= 0).");
    }
    payload.fine = { value, type: "PERCENTAGE" };
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhuma alteração informada.");
  }

  const atualizado = await atualizarCobrancaAsaas(config, asaasPaymentId, payload);

  await prisma.cobrancaAsaas.update({
    where: { id: local.id },
    data: {
      statusAsaas: atualizado.status || local.statusAsaas,
      bankSlipUrl: atualizado.bankSlipUrl || local.bankSlipUrl,
      invoiceUrl: atualizado.invoiceUrl || local.invoiceUrl,
      linhaDigitavel:
        atualizado.identificationField || local.linhaDigitavel,
    },
  });

  if (payload.dueDate) {
    await prisma.lancamento.update({
      where: { id: local.lancamentoId },
      data: { data: new Date(`${payload.dueDate}T12:00:00.000Z`) },
    });
  }

  invalidarCachePainelFinanceiro(empresaId);
  return obterBoletoAsaasEmpresa(empresaId, asaasPaymentId);
}

export async function cancelarBoletoAsaasEmpresa(
  empresaId: string,
  asaasPaymentId: string
): Promise<{ ok: true }> {
  const config = await configContaDigitalObrigatoria(empresaId);
  const local = await prisma.cobrancaAsaas.findFirst({
    where: {
      asaasPaymentId,
      lancamento: { empresaId, tipo: "receita" },
    },
  });
  if (!local) {
    throw new Error("Boleto não encontrado nesta empresa.");
  }

  const atual = await obterCobrancaAsaas(config, asaasPaymentId);
  if (cobrancaAsaasJaPaga(atual.status)) {
    throw new Error("Não é possível cancelar um boleto já pago.");
  }
  if (!cobrancaAsaasEditavel(atual.status) && atual.deleted !== true) {
    throw new Error(
      "Só é possível cancelar boletos pendentes ou vencidos."
    );
  }

  await excluirCobrancaAsaas(config, asaasPaymentId);
  await sincronizarPagamentoAsaas(asaasPaymentId, "DELETED");
  return { ok: true };
}
