/**
 * Limpeza de contas inativas — exclusão TOTAL (banco + pastas + nuvem).
 *
 * Remove: cadastros, OS, clientes, financeiro, usuários, uploads, backups,
 * pastas locais, OneDrive do lab e pasta no Google Drive. Não resta nada.
 *
 * Simular: npm run limpar:contas-inativas -- --simular
 * Executar: npm run limpar:contas-inativas
 * Cron VPS: 15 4 * * * cd /opt/lab-protese-saas && npm run limpar:contas-inativas
 */
import { existsSync, readFileSync } from "fs";
import path from "path";
import { executarSemRls } from "../src/lib/db";
import { prismaBase } from "../src/lib/prisma-base";
import { executarLimpezaContasInativas } from "../src/lib/exclusao-empresa";

function carregarDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const igual = trimmed.indexOf("=");
    if (igual === -1) continue;
    const chave = trimmed.slice(0, igual).trim();
    let valor = trimmed.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (chave) process.env[chave] = valor;
  }
}

async function main() {
  carregarDotEnv();
  const simular = process.argv.includes("--simular");
  const master = await executarSemRls((tx) =>
    tx.masterUser.findFirst({ select: { id: true } })
  );

  const resultado = await executarLimpezaContasInativas({
    simular,
    masterId: master?.id,
  });

  if (resultado.simulacao) {
    console.log(
      `[limpar-contas-inativas] simulação: ${resultado.avisosPendentes ?? 0} aviso(s) pendente(s), ${resultado.total} exclusão(ões) total(is).`
    );
    for (const empresa of resultado.empresas) {
      console.log(`  - ${empresa.slug} (${empresa.nome}) → apagar TODOS os dados e pastas`);
    }
    return;
  }

  console.log(
    `[limpar-contas-inativas] ${resultado.avisosEnviados ?? 0} aviso(s); ${resultado.total} conta(s) excluída(s) por completo (banco + arquivos + pastas).`
  );
  for (const empresa of resultado.empresas) {
    console.log(`  - ${empresa.slug} (${empresa.nome})`);
  }
}

main()
  .catch((erro) => {
    console.error("[limpar-contas-inativas]", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
