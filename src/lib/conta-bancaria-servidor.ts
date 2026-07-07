import { prisma } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  CONTAS_BANCARIAS_PADRAO,
  CONTAS_BANCARIAS_STORAGE_KEY,
  ID_CONTA_CARTEIRA,
  MOVIMENTACOES_CONTA_STORAGE_KEY,
  type ContaBancaria,
  type MovimentacaoContaBancaria,
  type VinculoOpenFinance,
} from "@/lib/conta-bancaria";
import {
  EXTRATO_BANCARIO_STORAGE_KEY,
  type ExtratoMovimentacao,
} from "@/lib/extrato-bancario";

const MIGRADO_KEY = "labProteseFinanceiroDbMigrado";

function parseDataIso(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function rowParaConta(row: {
  id: string;
  nome: string;
  saldoInicial: number;
  excluida: boolean;
  acaoPrincipal: string;
  codBanco: string;
  agencia: string;
  numeroConta: string;
  tipoChavePix: string;
  chavePix: string;
  modoVinculo: string;
  openFinanceJson: string | null;
}): ContaBancaria {
  let openFinance: VinculoOpenFinance | undefined;
  if (row.openFinanceJson) {
    try {
      openFinance = JSON.parse(row.openFinanceJson) as VinculoOpenFinance;
    } catch {
      openFinance = undefined;
    }
  }
  return {
    id: row.id,
    nome: row.nome,
    saldoInicial: row.saldoInicial,
    excluida: row.excluida,
    acaoPrincipal: row.acaoPrincipal as ContaBancaria["acaoPrincipal"],
    codBanco: row.codBanco || undefined,
    agencia: row.agencia || undefined,
    numeroConta: row.numeroConta || undefined,
    tipoChavePix: (row.tipoChavePix || "") as ContaBancaria["tipoChavePix"],
    chavePix: row.chavePix || undefined,
    modoVinculo: (row.modoVinculo || "manual") as ContaBancaria["modoVinculo"],
    openFinance,
  };
}

function contaParaRow(conta: ContaBancaria, empresaId: string) {
  return {
    empresaId,
    id: conta.id,
    nome: conta.nome,
    saldoInicial: conta.saldoInicial,
    excluida: Boolean(conta.excluida),
    acaoPrincipal: conta.acaoPrincipal || "movimentar",
    codBanco: conta.codBanco ?? "",
    agencia: conta.agencia ?? "",
    numeroConta: conta.numeroConta ?? "",
    tipoChavePix: conta.tipoChavePix ?? "",
    chavePix: conta.chavePix ?? "",
    modoVinculo: conta.modoVinculo ?? "manual",
    openFinanceJson: conta.openFinance
      ? JSON.stringify(conta.openFinance)
      : null,
  };
}

async function marcarMigracaoConcluida(empresaId: string) {
  await prisma.jsonStore.upsert({
    where: { key: `t:${empresaId}:${MIGRADO_KEY}` },
    create: { key: `t:${empresaId}:${MIGRADO_KEY}`, payload: "1" },
    update: { payload: "1" },
  });
}

async function migrarContasDoJsonStore(contasJson: ContaBancaria[], empresaId: string) {
  for (const conta of contasJson) {
    await prisma.contaBancaria.upsert({
      where: { id: conta.id },
      create: contaParaRow(conta, empresaId),
      update: contaParaRow(conta, empresaId),
    });
  }
}

async function migrarMovimentacoesDoJsonStore(
  movsJson: MovimentacaoContaBancaria[],
  contaIds: Set<string>
) {
  for (const mov of movsJson) {
    if (!contaIds.has(mov.contaId)) continue;
    await prisma.movimentacaoConta.upsert({
      where: { id: mov.id },
      create: {
        id: mov.id,
        contaId: mov.contaId,
        tipo: mov.tipo,
        valor: mov.valor,
        descricao: mov.descricao,
        data: parseDataIso(mov.data),
      },
      update: {
        contaId: mov.contaId,
        tipo: mov.tipo,
        valor: mov.valor,
        descricao: mov.descricao,
        data: parseDataIso(mov.data),
      },
    });
  }
}

async function migrarExtratoDoJsonStore(
  extratoJson: ExtratoMovimentacao[],
  contaIds: Set<string>
) {
  for (const item of extratoJson) {
    if (!contaIds.has(item.contaId)) continue;
    const idExterno = item.idExterno ?? null;
    const existente = idExterno
      ? await prisma.extratoMovimentacao.findFirst({
          where: { contaId: item.contaId, idExterno },
        })
      : await prisma.extratoMovimentacao.findUnique({ where: { id: item.id } });
    const dados = {
      contaId: item.contaId,
      tipo: item.tipo,
      valor: item.valor,
      descricao: item.descricao,
      data: parseDataIso(item.data),
      origem: item.origem,
      idExterno,
    };
    if (existente) {
      await prisma.extratoMovimentacao.update({
        where: { id: existente.id },
        data: dados,
      });
    } else {
      await prisma.extratoMovimentacao.upsert({
        where: { id: item.id },
        create: { id: item.id, ...dados },
        update: dados,
      });
    }
  }
}

async function migrarJsonStoreSeNecessario(empresaId: string) {
  try {
    const flag = await prisma.jsonStore.findUnique({
      where: { key: `t:${empresaId}:${MIGRADO_KEY}` },
    });
    if (flag?.payload === "1") return;

    const total = await prisma.contaBancaria.count({ where: { empresaId } });
    if (total > 0) {
      await marcarMigracaoConcluida(empresaId);
      return;
    }

    const contasJson =
      (await lerJsonStoreTenant<ContaBancaria[]>(
        empresaId,
        CONTAS_BANCARIAS_STORAGE_KEY
      )) || CONTAS_BANCARIAS_PADRAO;
    const movsJson =
      (await lerJsonStoreTenant<MovimentacaoContaBancaria[]>(
        empresaId,
        MOVIMENTACOES_CONTA_STORAGE_KEY
      )) || [];
    const extratoJson =
      (await lerJsonStoreTenant<ExtratoMovimentacao[]>(
        empresaId,
        EXTRATO_BANCARIO_STORAGE_KEY
      )) || [];

    await migrarContasDoJsonStore(contasJson, empresaId);
    const contaIds = new Set(contasJson.map((c) => c.id));

    try {
      await migrarMovimentacoesDoJsonStore(movsJson, contaIds);
    } catch (err) {
      console.error("[migrar movimentacoes conta]", err);
    }

    try {
      await migrarExtratoDoJsonStore(extratoJson, contaIds);
    } catch (err) {
      console.error("[migrar extrato bancario]", err);
    }

    await marcarMigracaoConcluida(empresaId);
  } catch (err) {
    console.error("[migrar financeiro contas]", err);
  }
}

export async function listarContasBancariasServidor(
  empresaId: string
): Promise<ContaBancaria[]> {
  await migrarJsonStoreSeNecessario(empresaId);
  const rows = await prisma.contaBancaria.findMany({
    where: { empresaId },
    orderBy: { nome: "asc" },
  });
  if (rows.length === 0) {
    await prisma.$transaction(async (tx) => {
      for (const conta of CONTAS_BANCARIAS_PADRAO) {
        await tx.contaBancaria.create({ data: contaParaRow(conta, empresaId) });
      }
    });
    const seeded = await prisma.contaBancaria.findMany({
      where: { empresaId },
      orderBy: { nome: "asc" },
    });
    return seeded.map(rowParaConta);
  }
  return rows.map((row) => {
    const conta = rowParaConta(row);
    if (conta.id === ID_CONTA_CARTEIRA && conta.nome.trim() === "Carteira Digital") {
      return { ...conta, nome: "Conta Bancária" };
    }
    return conta;
  });
}

export async function salvarContasBancariasServidor(
  empresaId: string,
  contas: ContaBancaria[]
) {
  await migrarJsonStoreSeNecessario(empresaId);
  const ids = contas.map((c) => c.id);
  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      await tx.contaBancaria.deleteMany({
        where: { empresaId, id: { notIn: ids } },
      });
    }
    for (const conta of contas) {
      await tx.contaBancaria.upsert({
        where: { id: conta.id },
        create: contaParaRow(conta, empresaId),
        update: contaParaRow(conta, empresaId),
      });
    }
  });
}

export async function listarMovimentacoesContaServidor(
  empresaId: string
): Promise<MovimentacaoContaBancaria[]> {
  await migrarJsonStoreSeNecessario(empresaId);
  const rows = await prisma.movimentacaoConta.findMany({
    where: { conta: { empresaId } },
    orderBy: { data: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    contaId: row.contaId,
    tipo: row.tipo as MovimentacaoContaBancaria["tipo"],
    valor: row.valor,
    descricao: row.descricao,
    data: row.data.toISOString(),
  }));
}

export async function salvarMovimentacoesContaServidor(
  empresaId: string,
  movs: MovimentacaoContaBancaria[]
) {
  await migrarJsonStoreSeNecessario(empresaId);
  const ids = movs.map((m) => m.id);
  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      await tx.movimentacaoConta.deleteMany({
        where: { id: { notIn: ids }, conta: { empresaId } },
      });
    }
    for (const mov of movs) {
      await tx.movimentacaoConta.upsert({
        where: { id: mov.id },
        create: {
          id: mov.id,
          contaId: mov.contaId,
          tipo: mov.tipo,
          valor: mov.valor,
          descricao: mov.descricao,
          data: parseDataIso(mov.data),
        },
        update: {
          contaId: mov.contaId,
          tipo: mov.tipo,
          valor: mov.valor,
          descricao: mov.descricao,
          data: parseDataIso(mov.data),
        },
      });
    }
  });
}

export async function listarExtratoBancarioServidor(
  empresaId: string
): Promise<ExtratoMovimentacao[]> {
  await migrarJsonStoreSeNecessario(empresaId);
  const rows = await prisma.extratoMovimentacao.findMany({
    where: { conta: { empresaId } },
    orderBy: { data: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    contaId: row.contaId,
    tipo: row.tipo as ExtratoMovimentacao["tipo"],
    valor: row.valor,
    descricao: row.descricao,
    data: row.data.toISOString(),
    origem: row.origem as ExtratoMovimentacao["origem"],
    idExterno: row.idExterno ?? undefined,
  }));
}

export async function salvarExtratoBancarioServidor(
  empresaId: string,
  itens: ExtratoMovimentacao[]
) {
  await migrarJsonStoreSeNecessario(empresaId);
  const ids = itens.map((i) => i.id);
  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      await tx.extratoMovimentacao.deleteMany({
        where: { id: { notIn: ids }, conta: { empresaId } },
      });
    }
    for (const item of itens) {
      const idExterno = item.idExterno ?? null;
      const existente = idExterno
        ? await tx.extratoMovimentacao.findFirst({
            where: { contaId: item.contaId, idExterno },
          })
        : null;
      const dados = {
        contaId: item.contaId,
        tipo: item.tipo,
        valor: item.valor,
        descricao: item.descricao,
        data: parseDataIso(item.data),
        origem: item.origem,
        idExterno,
      };
      if (existente) {
        await tx.extratoMovimentacao.update({
          where: { id: existente.id },
          data: dados,
        });
      } else {
        await tx.extratoMovimentacao.upsert({
          where: { id: item.id },
          create: { id: item.id, ...dados },
          update: dados,
        });
      }
    }
  });
}
