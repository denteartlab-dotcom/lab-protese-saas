import { prisma } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  CONTAS_BANCARIAS_PADRAO,
  CONTAS_BANCARIAS_STORAGE_KEY,
  garantirContasSistemaPadrao,
  ID_CONTA_CARTEIRA,
  idContaBancariaApp,
  idContaBancariaDb,
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
const IDS_CONTAS_SISTEMA = CONTAS_BANCARIAS_PADRAO.map((c) => c.id);

function parseDataIso(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function rowParaConta(
  row: {
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
  },
  empresaId: string
): ContaBancaria {
  let openFinance: VinculoOpenFinance | undefined;
  if (row.openFinanceJson) {
    try {
      openFinance = JSON.parse(row.openFinanceJson) as VinculoOpenFinance;
    } catch {
      openFinance = undefined;
    }
  }
  return {
    id: idContaBancariaApp(empresaId, row.id),
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
    id: idContaBancariaDb(empresaId, conta.id),
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

function linhaTemContaSistema(
  rows: { id: string }[],
  empresaId: string,
  appId: string
) {
  const dbId = idContaBancariaDb(empresaId, appId);
  return rows.some((r) => r.id === dbId || r.id === appId);
}

function idsDbContas(contas: ContaBancaria[], empresaId: string) {
  const ids = new Set(contas.map((c) => idContaBancariaDb(empresaId, c.id)));
  for (const conta of contas) {
    if (IDS_CONTAS_SISTEMA.includes(conta.id)) {
      ids.add(conta.id);
    }
  }
  return [...ids];
}

/** Migra cb-caixa etc. legados (id global) para id escopado por empresa. */
async function migrarIdsContaSistemaLegado(empresaId: string) {
  const legadas = await prisma.contaBancaria.findMany({
    where: { empresaId, id: { in: IDS_CONTAS_SISTEMA } },
  });
  for (const row of legadas) {
    const novoId = idContaBancariaDb(empresaId, row.id);
    if (novoId === row.id) continue;

    const destino = await prisma.contaBancaria.findUnique({ where: { id: novoId } });
    if (destino) {
      await prisma.$transaction(async (tx) => {
        await tx.movimentacaoConta.updateMany({
          where: { contaId: row.id },
          data: { contaId: novoId },
        });
        await tx.extratoMovimentacao.updateMany({
          where: { contaId: row.id },
          data: { contaId: novoId },
        });
        await tx.contaBancaria.delete({ where: { id: row.id } });
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.movimentacaoConta.updateMany({
        where: { contaId: row.id },
        data: { contaId: novoId },
      });
      await tx.extratoMovimentacao.updateMany({
        where: { contaId: row.id },
        data: { contaId: novoId },
      });
      await tx.contaBancaria.update({
        where: { id: row.id },
        data: { id: novoId },
      });
    });
  }
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
    const row = contaParaRow(conta, empresaId);
    await prisma.contaBancaria.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }
}

async function migrarMovimentacoesDoJsonStore(
  movsJson: MovimentacaoContaBancaria[],
  contaIds: Set<string>,
  empresaId: string
) {
  for (const mov of movsJson) {
    if (!contaIds.has(mov.contaId)) continue;
    const contaIdDb = idContaBancariaDb(empresaId, mov.contaId);
    await prisma.movimentacaoConta.upsert({
      where: { id: mov.id },
      create: {
        id: mov.id,
        contaId: contaIdDb,
        tipo: mov.tipo,
        valor: mov.valor,
        descricao: mov.descricao,
        data: parseDataIso(mov.data),
      },
      update: {
        contaId: contaIdDb,
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
  contaIds: Set<string>,
  empresaId: string
) {
  for (const item of extratoJson) {
    if (!contaIds.has(item.contaId)) continue;
    const contaIdDb = idContaBancariaDb(empresaId, item.contaId);
    const idExterno = item.idExterno ?? null;
    const existente = idExterno
      ? await prisma.extratoMovimentacao.findFirst({
          where: { contaId: contaIdDb, idExterno },
        })
      : await prisma.extratoMovimentacao.findUnique({ where: { id: item.id } });
    const dados = {
      contaId: contaIdDb,
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
      await migrarMovimentacoesDoJsonStore(movsJson, contaIds, empresaId);
    } catch (err) {
      console.error("[migrar movimentacoes conta]", err);
    }

    try {
      await migrarExtratoDoJsonStore(extratoJson, contaIds, empresaId);
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
  await migrarIdsContaSistemaLegado(empresaId);

  const rows = await prisma.contaBancaria.findMany({
    where: { empresaId },
    orderBy: { nome: "asc" },
  });

  if (rows.length === 0) {
    await prisma.$transaction(async (tx) => {
      for (const conta of CONTAS_BANCARIAS_PADRAO) {
        const row = contaParaRow(conta, empresaId);
        await tx.contaBancaria.create({ data: row });
      }
    });
    const seeded = await prisma.contaBancaria.findMany({
      where: { empresaId },
      orderBy: { nome: "asc" },
    });
    return seeded.map((row) => rowParaConta(row, empresaId));
  }

  const contas = garantirContasSistemaPadrao(
    rows.map((row) => {
      const conta = rowParaConta(row, empresaId);
      if (conta.id === ID_CONTA_CARTEIRA && conta.nome.trim() === "Carteira Digital") {
        return { ...conta, nome: "Conta Bancária" };
      }
      return conta;
    })
  );

  const faltando = CONTAS_BANCARIAS_PADRAO.filter(
    (p) => !linhaTemContaSistema(rows, empresaId, p.id)
  );
  if (faltando.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const conta of faltando) {
        const row = contaParaRow(conta, empresaId);
        await tx.contaBancaria.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        });
      }
    });
  }

  return contas;
}

export async function salvarContasBancariasServidor(
  empresaId: string,
  contas: ContaBancaria[]
) {
  await migrarJsonStoreSeNecessario(empresaId);
  await migrarIdsContaSistemaLegado(empresaId);

  const contasNormalizadas = garantirContasSistemaPadrao(contas);
  const idsDb = idsDbContas(contasNormalizadas, empresaId);

  await prisma.$transaction(async (tx) => {
    if (idsDb.length > 0) {
      await tx.contaBancaria.deleteMany({
        where: { empresaId, id: { notIn: idsDb } },
      });
    }
    for (const conta of contasNormalizadas) {
      const row = contaParaRow(conta, empresaId);
      await tx.contaBancaria.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    }
  });
}

export async function listarMovimentacoesContaServidor(
  empresaId: string
): Promise<MovimentacaoContaBancaria[]> {
  await migrarJsonStoreSeNecessario(empresaId);
  await migrarIdsContaSistemaLegado(empresaId);

  const rows = await prisma.movimentacaoConta.findMany({
    where: { conta: { empresaId } },
    orderBy: { data: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    contaId: idContaBancariaApp(empresaId, row.contaId),
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
  await migrarIdsContaSistemaLegado(empresaId);

  const ids = movs.map((m) => m.id);
  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      await tx.movimentacaoConta.deleteMany({
        where: { id: { notIn: ids }, conta: { empresaId } },
      });
    }
    for (const mov of movs) {
      const contaIdDb = idContaBancariaDb(empresaId, mov.contaId);
      await tx.movimentacaoConta.upsert({
        where: { id: mov.id },
        create: {
          id: mov.id,
          contaId: contaIdDb,
          tipo: mov.tipo,
          valor: mov.valor,
          descricao: mov.descricao,
          data: parseDataIso(mov.data),
        },
        update: {
          contaId: contaIdDb,
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
  await migrarIdsContaSistemaLegado(empresaId);

  const rows = await prisma.extratoMovimentacao.findMany({
    where: { conta: { empresaId } },
    orderBy: { data: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    contaId: idContaBancariaApp(empresaId, row.contaId),
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
  await migrarIdsContaSistemaLegado(empresaId);

  const ids = itens.map((i) => i.id);
  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      await tx.extratoMovimentacao.deleteMany({
        where: { id: { notIn: ids }, conta: { empresaId } },
      });
    }
    for (const item of itens) {
      const contaIdDb = idContaBancariaDb(empresaId, item.contaId);
      const idExterno = item.idExterno ?? null;
      const existente = idExterno
        ? await tx.extratoMovimentacao.findFirst({
            where: { contaId: contaIdDb, idExterno },
          })
        : null;
      const dados = {
        contaId: contaIdDb,
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
