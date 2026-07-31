/**
 * Testa o e-mail de aviso de exclusão por inatividade (não exclui nada).
 * Por padrão NÃO marca avisoInatividadeEnviadoEm (só envia o e-mail).
 *
 * Na VPS:
 *   # só para um lab
 *   npm run email:testar-inatividade -- --slug=denteart-1
 *
 *   # para todas as contas criadas (mesmo ativas)
 *   npm run email:testar-inatividade -- --todas --confirmar=ENVIAR
 *
 *   # para um e-mail avulso (preview com dados fictícios)
 *   npm run email:testar-inatividade -- --para=voce@email.com
 */
import { existsSync, readFileSync } from "fs";
import path from "path";
import { emailResendConfigurado } from "../src/lib/email-resend";
import { enviarEmailAvisoInatividade } from "../src/lib/email-aviso-inatividade";
import {
  DIAS_AVISO_INATIVIDADE_ANTES,
  resolverEmailAvisoInatividade,
} from "../src/lib/empresa-inatividade";
import { executarSemRls } from "../src/lib/db";
import { prismaBase } from "../src/lib/prisma-base";

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
    // última ocorrência vence (igual ao loader do app)
    if (chave) process.env[chave] = valor;
  }
}

function argValor(nome: string): string | null {
  const prefixo = `--${nome}=`;
  const hit = process.argv.find((a) => a.startsWith(prefixo));
  return hit ? hit.slice(prefixo.length).trim() : null;
}

function formatarDataBr(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

async function main() {
  carregarDotEnv();

  if (!emailResendConfigurado()) {
    console.error("ERRO: RESEND_API_KEY não configurada no .env");
    process.exit(1);
  }

  const para = argValor("para");
  const slug = argValor("slug");
  const todas = process.argv.includes("--todas");
  const confirmar = argValor("confirmar");
  const diasRestantes = Number(argValor("dias") || DIAS_AVISO_INATIVIDADE_ANTES) || 3;

  const dataExclusao = new Date();
  dataExclusao.setDate(dataExclusao.getDate() + diasRestantes);
  const dataExclusaoPrevista = formatarDataBr(dataExclusao);

  if (para) {
    console.log(`Enviando preview para ${para}...`);
    const r = await enviarEmailAvisoInatividade({
      to: para,
      nome: "Cliente (teste)",
      laboratorio: "Laboratório de Teste",
      diasRestantes,
      dataExclusaoPrevista,
    });
    if (!r.ok) {
      console.error("Falha:", r.erro);
      process.exit(1);
    }
    console.log("OK — e-mail de teste enviado. id=", r.id || "(sem id)");
    return;
  }

  if (!slug && !todas) {
    console.log(`Uso:
  npm run email:testar-inatividade -- --slug=denteart-1
  npm run email:testar-inatividade -- --todas --confirmar=ENVIAR
  npm run email:testar-inatividade -- --para=voce@email.com
`);
    process.exit(1);
  }

  if (todas && confirmar !== "ENVIAR") {
    console.error('Para enviar a TODAS as contas, use: --todas --confirmar=ENVIAR');
    process.exit(1);
  }

  const empresas = await executarSemRls((tx) =>
    tx.empresa.findMany({
      where: slug ? { slug: slug.trim().toLowerCase() } : undefined,
      select: { id: true, slug: true, nome: true, email: true, status: true },
      orderBy: { createdAt: "asc" },
    })
  );

  if (empresas.length === 0) {
    console.error(slug ? `Nenhuma empresa com slug=${slug}` : "Nenhuma empresa no banco.");
    process.exit(1);
  }

  console.log(
    `Enviando aviso de teste para ${empresas.length} conta(s) (diasRestantes=${diasRestantes}).`
  );
  console.log("Obs.: NÃO marca avisoInatividadeEnviadoEm — só testa o e-mail.\n");

  let ok = 0;
  let falha = 0;

  for (const empresa of empresas) {
    const dest = await resolverEmailAvisoInatividade(empresa);
    if (!dest) {
      console.warn(`  ✗ ${empresa.slug}: sem e-mail`);
      falha++;
      continue;
    }

    const r = await enviarEmailAvisoInatividade({
      to: dest.email,
      nome: dest.nome,
      laboratorio: empresa.nome,
      diasRestantes,
      dataExclusaoPrevista,
    });

    if (!r.ok) {
      console.warn(`  ✗ ${empresa.slug} → ${dest.email}: ${r.erro}`);
      falha++;
      continue;
    }

    console.log(`  ✓ ${empresa.slug} → ${dest.email}`);
    ok++;
  }

  console.log(`\nConcluído: ${ok} enviado(s), ${falha} falha(s).`);
}

main()
  .catch((erro) => {
    console.error("[email:testar-inatividade]", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
