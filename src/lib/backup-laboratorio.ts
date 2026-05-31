import type { PrismaClient } from "@prisma/client";

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_APP_ID = "lab-protese-saas";

export type BackupLaboratorioPayload = {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  app: typeof BACKUP_APP_ID;
  data: Record<string, unknown[]>;
};

const TABELAS_EXPORTAR = [
  "User",
  "SequenciaNumerica",
  "JsonStore",
  "Produto",
  "Cliente",
  "Paciente",
  "Trabalho",
  "Lancamento",
  "NfseEmissao",
  "CobrancaAsaas",
  "LogAuditoria",
  "Orcamento",
] as const;

const ORDEM_IMPORTACAO = [...TABELAS_EXPORTAR];

const ORDEM_EXCLUSAO = [...ORDEM_IMPORTACAO].reverse();

function serializarValor(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
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
      /^(createdAt|updatedAt|data|excluidoEm|nascimento|dataEntrada|dataPrevista|dataEntrega|dataAlteracao|dataResposta)$/.test(
        k
      ) &&
      /^\d{4}-\d{2}-\d{2}/.test(v)
    ) {
      out[k] = new Date(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
    }
  }
  return out;
}

export async function exportarBackupLaboratorio(
  prisma: PrismaClient
): Promise<BackupLaboratorioPayload> {
  const data: Record<string, unknown[]> = {};

  data.User = await prisma.user.findMany();
  data.SequenciaNumerica = await prisma.sequenciaNumerica.findMany();
  data.JsonStore = await prisma.jsonStore.findMany();
  data.Produto = await prisma.produto.findMany();
  data.Cliente = await prisma.cliente.findMany();
  data.Paciente = await prisma.paciente.findMany();
  data.Trabalho = await prisma.trabalho.findMany();
  data.Lancamento = await prisma.lancamento.findMany();
  data.NfseEmissao = await prisma.nfseEmissao.findMany();
  data.CobrancaAsaas = await prisma.cobrancaAsaas.findMany();
  data.LogAuditoria = await prisma.logAuditoria.findMany();
  data.Orcamento = await prisma.orcamento.findMany();

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
    data: serializado,
  };
}

export function validarBackupLaboratorio(
  body: unknown
): BackupLaboratorioPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as BackupLaboratorioPayload;
  if (b.version !== BACKUP_FORMAT_VERSION) return null;
  if (b.app !== BACKUP_APP_ID) return null;
  if (!b.data || typeof b.data !== "object") return null;
  return b;
}

async function excluirTudo(prisma: PrismaClient) {
  for (const tabela of ORDEM_EXCLUSAO) {
    switch (tabela) {
      case "CobrancaAsaas":
        await prisma.cobrancaAsaas.deleteMany();
        break;
      case "NfseEmissao":
        await prisma.nfseEmissao.deleteMany();
        break;
      case "Lancamento":
        await prisma.lancamento.deleteMany();
        break;
      case "Trabalho":
        await prisma.trabalho.deleteMany();
        break;
      case "Paciente":
        await prisma.paciente.deleteMany();
        break;
      case "Orcamento":
        await prisma.orcamento.deleteMany();
        break;
      case "LogAuditoria":
        await prisma.logAuditoria.deleteMany();
        break;
      case "Cliente":
        await prisma.cliente.deleteMany();
        break;
      case "Produto":
        await prisma.produto.deleteMany();
        break;
      case "JsonStore":
        await prisma.jsonStore.deleteMany();
        break;
      case "SequenciaNumerica":
        await prisma.sequenciaNumerica.deleteMany();
        break;
      case "User":
        await prisma.user.deleteMany();
        break;
    }
  }
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
    }
  }
}

export type ResultadoImportBackup = {
  contagens: Record<string, number>;
};

export async function importarBackupLaboratorio(
  prisma: PrismaClient,
  backup: BackupLaboratorioPayload
): Promise<ResultadoImportBackup> {
  const contagens: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    await excluirTudo(db);

    for (const tabela of ORDEM_IMPORTACAO) {
      const linhas = backup.data[tabela];
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
