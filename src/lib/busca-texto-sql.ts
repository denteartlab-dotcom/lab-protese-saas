import { Prisma } from "@prisma/client";
import { semAcento } from "@/lib/busca-texto";
import { numeroOsInternoDaBusca } from "@/lib/os-externa";
import { executarComTenant } from "@/lib/prisma-tenant";

const COM_ACENTO =
  "áàâãäåéèêëíìîïóòôõöúùûüýÿçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝŸÇÑABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SEM_ACENTO =
  "aaaaaaeeeeiiiiooooouuuuyycnaaaaaaeeeeiiiiooooouuuuyycnabcdefghijklmnopqrstuvwxyz";

function padraoLike(termo: string) {
  const q = semAcento(termo)
    .trim()
    .replace(/[%_\\]/g, "");
  return `%${q}%`;
}

function sqlFold(coluna: Prisma.Sql) {
  return Prisma.sql`translate(coalesce(${coluna}, ''), ${COM_ACENTO}, ${SEM_ACENTO})`;
}

function sqlContem(coluna: Prisma.Sql, termo: string) {
  return Prisma.sql`${sqlFold(coluna)} LIKE ${padraoLike(termo)}`;
}

async function idsDaConsulta(empresaId: string, sql: Prisma.Sql) {
  const rows = await executarComTenant(empresaId, (tx) =>
    tx.$queryRaw<Array<{ id: string }>>(sql)
  );
  return rows.map((row) => row.id);
}

export function restringirIds(ids: string[]) {
  return { id: { in: ids.length > 0 ? ids : ["__nenhum__"] } };
}

/** IDs de OS cujo paciente, cliente, serviço ou instrução contém o termo sem acento. */
export function idsTrabalhoPorBusca(empresaId: string, termo: string) {
  const q = termo.trim();
  if (!q) return Promise.resolve([] as string[]);
  const interno = numeroOsInternoDaBusca(q);
  const partes: Prisma.Sql[] = [
    sqlContem(Prisma.sql`p.nome`, q),
    sqlContem(Prisma.sql`c.nome`, q),
    sqlContem(Prisma.sql`t."tipoProtese"`, q),
    sqlContem(Prisma.sql`t.instrucoes`, q),
    sqlContem(Prisma.sql`t.observacoes`, q),
    Prisma.sql`t.id = ${q}`,
  ];
  if (interno != null) partes.push(Prisma.sql`t."numeroOs" = ${interno}`);
  if (/\d/.test(q)) {
    partes.push(Prisma.sql`(
      t.instrucoes ILIKE '%OS Externa:%'
      OR t.instrucoes ILIKE '%OS Externo:%'
      OR t.instrucoes ILIKE '%OS Interna:%'
    )`);
  }
  return idsDaConsulta(
    empresaId,
    Prisma.sql`
      SELECT t.id
      FROM "Trabalho" t
      LEFT JOIN "Paciente" p ON p.id = t."pacienteId"
      LEFT JOIN "Cliente" c ON c.id = t."clienteId"
      WHERE t."empresaId" = ${empresaId}
        AND (${Prisma.join(partes, " OR ")})
    `
  );
}

export function idsClientePorBusca(empresaId: string, termo: string) {
  const q = termo.trim();
  if (!q) return Promise.resolve([] as string[]);
  const partes = [
    Prisma.sql`nome`,
    Prisma.sql`"razaoSocial"`,
    Prisma.sql`email`,
    Prisma.sql`cro`,
    Prisma.sql`"cnpjCpf"`,
    Prisma.sql`telefone`,
    Prisma.sql`celular`,
    Prisma.sql`cidade`,
  ].map((coluna) => sqlContem(coluna, q));
  return idsDaConsulta(
    empresaId,
    Prisma.sql`
      SELECT id
      FROM "Cliente"
      WHERE "empresaId" = ${empresaId}
        AND (${Prisma.join(partes, " OR ")})
    `
  );
}

export function idsPacientePorBusca(empresaId: string, termo: string) {
  const q = termo.trim();
  if (!q) return Promise.resolve([] as string[]);
  return idsDaConsulta(
    empresaId,
    Prisma.sql`
      SELECT p.id
      FROM "Paciente" p
      JOIN "Cliente" c ON c.id = p."clienteId"
      WHERE c."empresaId" = ${empresaId}
        AND (
          ${sqlContem(Prisma.sql`p.nome`, q)}
          OR ${sqlContem(Prisma.sql`p.cpf`, q)}
          OR ${sqlContem(Prisma.sql`c.nome`, q)}
        )
    `
  );
}

export function idsCampanhaWhatsappPorBusca(empresaId: string, termo: string) {
  const q = termo.trim();
  if (!q) return Promise.resolve([] as string[]);
  return idsDaConsulta(
    empresaId,
    Prisma.sql`
      SELECT id
      FROM whatsapp_campaigns
      WHERE "empresaId" = ${empresaId}
        AND ${sqlContem(Prisma.sql`nome`, q)}
    `
  );
}

export function idsLancamentoPorBusca(empresaId: string, termo: string) {
  const q = termo.trim();
  if (!q) return Promise.resolve([] as string[]);
  return idsDaConsulta(
    empresaId,
    Prisma.sql`
      SELECT l.id
      FROM "Lancamento" l
      LEFT JOIN "Cliente" c ON c.id = l."clienteId"
      WHERE l."empresaId" = ${empresaId}
        AND (
          ${sqlContem(Prisma.sql`l.descricao`, q)}
          OR ${sqlContem(Prisma.sql`c.nome`, q)}
        )
    `
  );
}
