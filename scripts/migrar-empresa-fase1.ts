/**
 * Migração multi-tenant — Fases 1, 2 e 5 (ver também migrar-empresa-fase5.ts).
 *
 * Uso (após prisma db push):
 *   npm run db:migrar-empresa
 */
import { PrismaClient } from "@prisma/client";
import { copiarJsonStoreLegadoParaTenant } from "../src/lib/json-store-tenant";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";
const NOME_PADRAO = process.env.EMPRESA_NOME_PADRAO?.trim() || "DenteArt";

async function main() {
  console.log("Migração multi-tenant — Fases 1 e 2\n");

  let empresa = await prisma.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: {
        nome: NOME_PADRAO,
        slug: SLUG_PADRAO,
        plano: "basico",
        status: "ativo",
      },
    });
    console.log(`Empresa criada: ${empresa.nome} (${empresa.slug})`);
  } else {
    console.log(`Empresa existente: ${empresa.nome} (${empresa.slug})`);
  }

  const empresaId = empresa.id;

  const outrasEmpresas = await prisma.empresa.findMany({
    where: { id: { not: empresaId } },
    select: { id: true, slug: true },
  });
  const idsOutrasEmpresas = outrasEmpresas.map((e) => e.id);
  if (outrasEmpresas.length > 0) {
    console.log(
      `Preservando dados de ${outrasEmpresas.length} outra(s) empresa(s): ${outrasEmpresas.map((e) => e.slug).join(", ")}`
    );
  }

  /** Só vincula ao padrão registros que ainda não pertencem a outro laboratório. */
  const filtroLegado = { empresaId: { notIn: idsOutrasEmpresas } } as const;

  const tabelas = [
    ["User", () => prisma.user.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["Cliente", () => prisma.cliente.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["Trabalho", () => prisma.trabalho.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["Produto", () => prisma.produto.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["Lancamento", () => prisma.lancamento.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["Orcamento", () => prisma.orcamento.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["ArquivoUpload", () => prisma.arquivoUpload.updateMany({ where: filtroLegado, data: { empresaId } })],
    ["ContaBancaria", () => prisma.contaBancaria.updateMany({ where: filtroLegado, data: { empresaId } })],
  ] as const;

  for (const [nome, fn] of tabelas) {
    try {
      const r = await fn();
      console.log(`${nome} vinculados: ${r.count}`);
    } catch (err) {
      console.warn(`${nome}: pulado (${err instanceof Error ? err.message : err})`);
    }
  }

  const maiorOs = await prisma.trabalho.aggregate({
    where: { empresaId },
    _max: { numeroOs: true },
  });
  await prisma.sequenciaNumerica.upsert({
    where: { empresaId_chave: { empresaId, chave: "numero_os" } },
    create: { empresaId, chave: "numero_os", valor: maiorOs._max.numeroOs ?? 0 },
    update: { valor: maiorOs._max.numeroOs ?? 0 },
  });

  const maiorPedido = await prisma.orcamento.aggregate({
    where: { empresaId },
    _max: { numeroPedido: true },
  });
  await prisma.sequenciaNumerica.upsert({
    where: { empresaId_chave: { empresaId, chave: "numero_pedido_orcamento" } },
    create: {
      empresaId,
      chave: "numero_pedido_orcamento",
      valor: maiorPedido._max.numeroPedido ?? 0,
    },
    update: { valor: maiorPedido._max.numeroPedido ?? 0 },
  });

  const jsonCopiados = await copiarJsonStoreLegadoParaTenant(empresaId);
  console.log(`JsonStore copiados para tenant: ${jsonCopiados}`);

  console.log("\nMigração concluída.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
