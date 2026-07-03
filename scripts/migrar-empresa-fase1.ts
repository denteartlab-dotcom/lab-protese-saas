/**
 * Migração multi-tenant — Fases 1, 2 e 5 (ver também migrar-empresa-fase5.ts).
 *
 * Uso (após prisma db push):
 *   npm run db:migrar-empresa
 *
 * Com FORCE RLS, precisa de app.rls_bypass=true (mesmo como owner).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { copiarJsonStoreLegadoParaTenant } from "../src/lib/json-store-tenant";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";
const NOME_PADRAO = process.env.EMPRESA_NOME_PADRAO?.trim() || "DenteArt";

async function comBypassRls<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
      return fn(tx);
    },
    { maxWait: 15_000, timeout: 300_000 }
  );
}

async function main() {
  console.log("Migração multi-tenant — Fases 1 e 2\n");

  await comBypassRls(async (tx) => {
    let empresa = await tx.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
    if (!empresa) {
      empresa = await tx.empresa.create({
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

    const outrasEmpresas = await tx.empresa.findMany({
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
      ["User", () => tx.user.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["Cliente", () => tx.cliente.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["Trabalho", () => tx.trabalho.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["Produto", () => tx.produto.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["Lancamento", () => tx.lancamento.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["Orcamento", () => tx.orcamento.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["ArquivoUpload", () => tx.arquivoUpload.updateMany({ where: filtroLegado, data: { empresaId } })],
      ["ContaBancaria", () => tx.contaBancaria.updateMany({ where: filtroLegado, data: { empresaId } })],
    ] as const;

    for (const [nome, fn] of tabelas) {
      try {
        const r = await fn();
        console.log(`${nome} vinculados: ${r.count}`);
      } catch (err) {
        console.warn(`${nome}: pulado (${err instanceof Error ? err.message : err})`);
      }
    }

    const maiorOs = await tx.trabalho.aggregate({
      where: { empresaId },
      _max: { numeroOs: true },
    });
    await tx.sequenciaNumerica.upsert({
      where: { empresaId_chave: { empresaId, chave: "numero_os" } },
      create: { empresaId, chave: "numero_os", valor: maiorOs._max.numeroOs ?? 0 },
      update: { valor: maiorOs._max.numeroOs ?? 0 },
    });

    const maiorPedido = await tx.orcamento.aggregate({
      where: { empresaId },
      _max: { numeroPedido: true },
    });
    await tx.sequenciaNumerica.upsert({
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
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
