/**
 * Migra contas bancárias, movimentações e extrato do JsonStore para as tabelas PostgreSQL.
 * Rode com .env apontando para o Neon:
 *
 *   npx tsx scripts/migrar-financeiro-neon.ts
 */
import {
  listarContasBancariasServidor,
  listarExtratoBancarioServidor,
  listarMovimentacoesContaServidor,
} from "../src/lib/conta-bancaria-servidor";

async function main() {
  const contas = await listarContasBancariasServidor();
  const movimentacoes = await listarMovimentacoesContaServidor();
  const extrato = await listarExtratoBancarioServidor();
  console.log("Migração concluída:");
  console.log(`  Contas: ${contas.length}`);
  console.log(`  Movimentações: ${movimentacoes.length}`);
  console.log(`  Extrato: ${extrato.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
