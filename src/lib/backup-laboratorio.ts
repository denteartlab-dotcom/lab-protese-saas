import type { PrismaClient } from "@prisma/client";
import { chaveJsonStoreTenant } from "@/lib/json-store-tenant";

export const BACKUP_FORMAT_VERSION = 2;
export const BACKUP_APP_ID = "lab-protese-saas";

export type BackupLaboratorioPayload = {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  app: typeof BACKUP_APP_ID;
  empresaId: string;
  empresaSlug: string;
  empresaNome: string;
  data: Record<string, unknown[]>;
};

const TABELAS_IMPORTACAO = [
  "CobrancaAsaas",
  "NfseEmissao",
  "MovimentacaoConta",
  "ExtratoMovimentacao",
  "Lancamento",
  "HistoricoEtapa",
  "Trabalho",
  "Paciente",
  "Orcamento",
  "LogAuditoria",
  "ArquivoUpload",
  "ContaBancaria",
  "Cliente",
  "Produto",
  "JsonStore",
  "SequenciaNumerica",
  "User",
] as const;

function serializarValor(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "bigint") return valor.toString();
  if (Array.isArray(valor)) return valor.map(serializarValor);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
        k,
        serializarValor(v),
      ])
    );
  }
  return valor;
}

function normalizarLinhaImport(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "boolean") continue;
    if (
      typeof v === "string" &&
      /^(createdAt|updatedAt|data|excluidoEm|nascimento|dataEntrada|dataPrevista|dataEntrega|dataAlteracao|dataResposta|dataEntrada|dataSaida)$/.test(
        k
      ) &&
      /^\d{4}-\d{2}-\d{2}/.test(v)
    ) {
      out[k] = new Date(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
    }
  }
  return out;
}

async function carregarEmpresaBackup(prisma: PrismaClient, empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, slug: true, nome: true, status: true },
  });
  if (!empresa) throw new Error("EMPRESA_NAO_ENCONTRADA");
  return empresa;
}

export async function exportarBackupEmpresa(
  prisma: PrismaClient,
  empresaId: string
): Promise<BackupLaboratorioPayload> {
  const empresa = await carregarEmpresaBackup(prisma, empresaId);
  const prefixoTenant = `t:${empresaId}:`;

  const [
    users,
    sequencias,
    jsonStore,
    produtos,
    clientes,
    trabalhos,
    lancamentos,
    orcamentos,
    uploads,
    contas,
  ] = await Promise.all([
    prisma.user.findMany({ where: { empresaId } }),
    prisma.sequenciaNumerica.findMany({ where: { empresaId } }),
    prisma.jsonStore.findMany({ where: { key: { startsWith: prefixoTenant } } }),
    prisma.produto.findMany({ where: { empresaId } }),
    prisma.cliente.findMany({ where: { empresaId } }),
    prisma.trabalho.findMany({ where: { empresaId } }),
    prisma.lancamento.findMany({ where: { empresaId } }),
    prisma.orcamento.findMany({ where: { empresaId } }),
    prisma.arquivoUpload.findMany({ where: { empresaId } }),
    prisma.contaBancaria.findMany({ where: { empresaId } }),
  ]);

  const clienteIds = clientes.map((c) => c.id);
  const lancamentoIds = lancamentos.map((l) => l.id);
  const contaIds = contas.map((c) => c.id);

  const [pacientes, nfse, cobrancas, logs, historico, movimentacoes, extratos] =
    await Promise.all([
      clienteIds.length
        ? prisma.paciente.findMany({ where: { clienteId: { in: clienteIds } } })
        : Promise.resolve([]),
      prisma.nfseEmissao.findMany({ where: { empresaId } }),
      lancamentoIds.length
        ? prisma.cobrancaAsaas.findMany({
            where: { lancamentoId: { in: lancamentoIds } },
          })
        : Promise.resolve([]),
      prisma.logAuditoria.findMany({ where: { empresaId } }),
      prisma.historicoEtapa.findMany({ where: { empresaId } }),
      contaIds.length
        ? prisma.movimentacaoConta.findMany({
            where: { contaId: { in: contaIds } },
          })
        : Promise.resolve([]),
      contaIds.length
        ? prisma.extratoMovimentacao.findMany({
            where: { contaId: { in: contaIds } },
          })
        : Promise.resolve([]),
    ]);

  const data: Record<string, unknown[]> = {
    Empresa: [empresa],
    User: users,
    SequenciaNumerica: sequencias,
    JsonStore: jsonStore,
    Produto: produtos,
    Cliente: clientes,
    Paciente: pacientes,
    Trabalho: trabalhos,
    Lancamento: lancamentos,
    NfseEmissao: nfse,
    CobrancaAsaas: cobrancas,
    LogAuditoria: logs,
    Orcamento: orcamentos,
    ArquivoUpload: uploads.map((a) => ({
      ...a,
      dados: Buffer.from(a.dados).toString("base64"),
    })),
    ContaBancaria: contas,
    MovimentacaoConta: movimentacoes,
    ExtratoMovimentacao: extratos,
    HistoricoEtapa: historico,
  };

  const serializado = Object.fromEntries(
    Object.entries(data).map(([tabela, linhas]) => [
      tabela,
      linhas.map((linha) => serializarValor(linha) as Record<string, unknown>),
    ])
  );

  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: BACKUP_APP_ID,
    empresaId: empresa.id,
    empresaSlug: empresa.slug,
    empresaNome: empresa.nome,
    data: serializado,
  };
}

/** @deprecated Use exportarBackupEmpresa */
export async function exportarBackupLaboratorio(
  prisma: PrismaClient,
  empresaId: string
) {
  return exportarBackupEmpresa(prisma, empresaId);
}

export function validarBackupLaboratorio(
  body: unknown
): BackupLaboratorioPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as BackupLaboratorioPayload;
  if (b.version !== BACKUP_FORMAT_VERSION) return null;
  if (b.app !== BACKUP_APP_ID) return null;
  if (!b.empresaId || typeof b.empresaId !== "string") return null;
  if (!b.data || typeof b.data !== "object") return null;
  return b;
}

export function backupPertenceAEmpresa(
  backup: BackupLaboratorioPayload,
  empresaId: string
) {
  return backup.empresaId === empresaId;
}

async function excluirDadosEmpresa(prisma: PrismaClient, empresaId: string) {
  const prefixoTenant = `t:${empresaId}:`;

  const [lancamentos, clientes, contas] = await Promise.all([
    prisma.lancamento.findMany({
      where: { empresaId },
      select: { id: true },
    }),
    prisma.cliente.findMany({
      where: { empresaId },
      select: { id: true },
    }),
    prisma.contaBancaria.findMany({
      where: { empresaId },
      select: { id: true },
    }),
  ]);

  const lancamentoIds = lancamentos.map((l) => l.id);
  const clienteIds = clientes.map((c) => c.id);
  const contaIds = contas.map((c) => c.id);

  if (lancamentoIds.length) {
    await prisma.cobrancaAsaas.deleteMany({
      where: { lancamentoId: { in: lancamentoIds } },
    });
  }

  await prisma.nfseEmissao.deleteMany({ where: { empresaId } });
  await prisma.historicoEtapa.deleteMany({ where: { empresaId } });
  await prisma.logAuditoria.deleteMany({ where: { empresaId } });

  await prisma.lancamento.deleteMany({ where: { empresaId } });

  await prisma.trabalho.deleteMany({ where: { empresaId } });

  if (clienteIds.length) {
    await prisma.paciente.deleteMany({
      where: { clienteId: { in: clienteIds } },
    });
  }

  await prisma.orcamento.deleteMany({ where: { empresaId } });

  if (contaIds.length) {
    await prisma.movimentacaoConta.deleteMany({
      where: { contaId: { in: contaIds } },
    });
    await prisma.extratoMovimentacao.deleteMany({
      where: { contaId: { in: contaIds } },
    });
  }

  await prisma.arquivoUpload.deleteMany({ where: { empresaId } });
  await prisma.contaBancaria.deleteMany({ where: { empresaId } });
  await prisma.cliente.deleteMany({ where: { empresaId } });
  await prisma.produto.deleteMany({ where: { empresaId } });

  const chavesTenant = await prisma.jsonStore.findMany({
    where: { key: { startsWith: prefixoTenant } },
    select: { key: true },
  });
  if (chavesTenant.length) {
    await prisma.jsonStore.deleteMany({
      where: { key: { in: chavesTenant.map((k) => k.key) } },
    });
  }

  await prisma.sequenciaNumerica.deleteMany({ where: { empresaId } });
  await prisma.user.deleteMany({ where: { empresaId } });
}

async function inserirLinhas(
  prisma: PrismaClient,
  tabela: string,
  linhas: unknown[]
) {
  for (const raw of linhas) {
    if (!raw || typeof raw !== "object") continue;
    const row = normalizarLinhaImport(raw as Record<string, unknown>);

    switch (tabela) {
      case "User":
        await prisma.user.create({ data: row as never });
        break;
      case "SequenciaNumerica":
        await prisma.sequenciaNumerica.create({ data: row as never });
        break;
      case "JsonStore":
        await prisma.jsonStore.create({ data: row as never });
        break;
      case "Produto":
        await prisma.produto.create({ data: row as never });
        break;
      case "Cliente":
        await prisma.cliente.create({ data: row as never });
        break;
      case "Paciente":
        await prisma.paciente.create({ data: row as never });
        break;
      case "Trabalho":
        await prisma.trabalho.create({ data: row as never });
        break;
      case "Lancamento":
        await prisma.lancamento.create({ data: row as never });
        break;
      case "NfseEmissao":
        await prisma.nfseEmissao.create({ data: row as never });
        break;
      case "CobrancaAsaas":
        await prisma.cobrancaAsaas.create({ data: row as never });
        break;
      case "LogAuditoria":
        await prisma.logAuditoria.create({ data: row as never });
        break;
      case "Orcamento":
        await prisma.orcamento.create({ data: row as never });
        break;
      case "ArquivoUpload": {
        const dadosB64 = row.dados;
        const dados =
          typeof dadosB64 === "string"
            ? Buffer.from(dadosB64, "base64")
            : Buffer.alloc(0);
        const { dados: _d, ...resto } = row;
        await prisma.arquivoUpload.create({
          data: { ...resto, dados } as never,
        });
        break;
      }
      case "ContaBancaria":
        await prisma.contaBancaria.create({ data: row as never });
        break;
      case "MovimentacaoConta":
        await prisma.movimentacaoConta.create({ data: row as never });
        break;
      case "ExtratoMovimentacao":
        await prisma.extratoMovimentacao.create({ data: row as never });
        break;
      case "HistoricoEtapa":
        await prisma.historicoEtapa.create({ data: row as never });
        break;
    }
  }
}

export function aplicarExclusaoDreNoBackup(
  backup: BackupLaboratorioPayload
): BackupLaboratorioPayload {
  const lancamentos = backup.data.Lancamento;
  if (!Array.isArray(lancamentos)) return backup;
  const filtrados = lancamentos.filter((linha) => {
    if (!linha || typeof linha !== "object") return true;
    return (linha as { status?: string }).status !== "pago";
  });
  return {
    ...backup,
    data: {
      ...backup.data,
      Lancamento: filtrados,
    },
  };
}

export type OpcoesImportBackup = {
  /** Não restaura lançamentos pagos (dados que alimentam a D.R.E.). */
  excluirDre?: boolean;
};

export type ResultadoImportBackup = {
  contagens: Record<string, number>;
};

export async function importarBackupEmpresa(
  prisma: PrismaClient,
  backup: BackupLaboratorioPayload,
  empresaId: string,
  opts: OpcoesImportBackup = {}
): Promise<ResultadoImportBackup> {
  if (!backupPertenceAEmpresa(backup, empresaId)) {
    throw new Error("BACKUP_OUTRA_EMPRESA");
  }

  const payload = opts.excluirDre ? aplicarExclusaoDreNoBackup(backup) : backup;
  const contagens: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    await excluirDadosEmpresa(db, empresaId);

    for (const tabela of TABELAS_IMPORTACAO) {
      const linhas = payload.data[tabela];
      if (!Array.isArray(linhas)) {
        contagens[tabela] = 0;
        continue;
      }
      await inserirLinhas(db, tabela, linhas);
      contagens[tabela] = linhas.length;
    }
  });

  return { contagens };
}

/** @deprecated Use importarBackupEmpresa */
export async function importarBackupLaboratorio(
  prisma: PrismaClient,
  backup: BackupLaboratorioPayload,
  empresaId: string
) {
  return importarBackupEmpresa(prisma, backup, empresaId);
}

export { chaveJsonStoreTenant };
