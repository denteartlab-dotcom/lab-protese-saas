/**
 * Zera todo o banco e arquivos locais, deixando apenas o proprietário padrão.
 *
 * Uso:
 *   npx tsx scripts/zerar-sistema-virgem.ts --confirmar=ZERAR
 *
 * Variáveis opcionais:
 *   ZERAR_EMAIL_PROPRIETARIO  (padrão: admin@labprotese.com)
 *   ZERAR_SENHA_PROPRIETARIO  (padrão: 789654)
 */
import { rm } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { CONFIG_LAB_PADRAO, CONFIG_LAB_STORAGE_KEY } from "../src/lib/configuracoes-lab";
import { ASAAS_CONFIG_KEY, ASAAS_CONFIG_PADRAO } from "../src/lib/asaas-config";
import { NFSE_CONFIG_KEY, NFSE_CONFIG_PADRAO } from "../src/lib/nfse-config";
import {
  BACKUP_AUTOMATICO_CONFIG_KEY,
  CONFIG_BACKUP_AUTOMATICO_PADRAO,
} from "../src/lib/backup-automatico-config";

const prisma = new PrismaClient();

const EMAIL_PADRAO = process.env.ZERAR_EMAIL_PROPRIETARIO?.trim() || "admin@labprotese.com";
const SENHA_PADRAO = process.env.ZERAR_SENHA_PROPRIETARIO?.trim() || "789654";

const TABELA_PRECOS_VAZIA = {
  tabela: "Tabela Principal",
  tabelas: ["Tabela Principal"],
  categoriasPorTabela: { "Tabela Principal": [] },
};

const JSON_VAZIOS: Record<string, unknown> = {
  labProtesePlanoContas: [],
  labProtesePlanoContasVersion: 1,
  labProteseContasBancarias: [],
  labProteseContasBancariasVersion: 1,
  labProteseMovimentacoesConta: [],
  labProteseLancamentosFinanceiroCache: [],
  labProteseExtratoBancario: [],
  labProteseProdutosEstoqueExtras: {},
  labProteseProdutosEstoqueMovimentos: [],
  labProteseProdutosEstoqueOsMovimentos: [],
  labProteseOrcamentosEstoqueAplicados: [],
  labProteseProdutosExcluidos: [],
  labProteseProdutosExcluidosSnapshots: {},
  labProteseProdutosRemovidosPermanentemente: [
    "padrao-brux",
    "padrao-deline",
    "padrao-estrutura",
    "padrao-investa",
    "padrao-newflex",
    "padrao-trilux",
  ],
  labProteseTabelaPrecos: TABELA_PRECOS_VAZIA,
  labProteseItensCustoCadastro: [],
  labProteseEtapas: [],
  labProteseEtapasExcluidas: [],
  labProteseSetores: [],
  labProteseSetoresExcluidos: [],
  labProteseColaboradores: [],
  labProteseColaboradoresExcluidos: [],
  labProtesePrestadores: [],
  labProtesePrestadoresExcluidos: [],
  labProteseEntregadores: [],
  labProteseEntregadoresExcluidos: [],
  labProteseFornecedores: [],
  labProteseFornecedoresExcluidos: [],
  labProteseCategoriasFornecedores: [],
  labProteseMateriaisDentista: [],
  labProteseHorarioFuncionamento: { dias: [] },
  labProteseConfiguracoesGerais: {},
  labProteseConfiguracoesOs: {},
  labProteseConfiguracoesFaturas: {},
  labProteseConfiguracoesEtiquetas: {},
  labProteseOrcamentos: [],
  labProteseListaConfigs: {},
  labProteseControleProdutos: [],
  labProteseControleFichasSemServicos: [],
  labProteseNotificacoesLidas: [],
  labProteseNotificacoesDescartadas: [],
  labProteseNotifSistema: [],
  labProteseAnotacoesDashboard: [],
  labProteseControleComissaoZero: [],
  labProteseControlePrestadoresComissaoZero: [],
  labProteseControleProdutor: {},
  labProteseControleEntregas: [],
  labProteseModuloProducaoEtapas: {},
  labProteseUrgenciasCliente: {},
  labProteseTentativasSenhaRestaurar: {},
};

function confirmado() {
  return process.argv.some((arg) => arg === "--confirmar=ZERAR");
}

function hostBanco(url: string) {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return "(url inválida)";
  }
}

async function limparPastasLocais() {
  const pastas = [
    path.join(process.cwd(), "public", "uploads"),
    path.join(process.cwd(), "backups"),
  ];
  for (const pasta of pastas) {
    try {
      await rm(pasta, { recursive: true, force: true });
    } catch {
      /* ignorar */
    }
  }
}

async function gravarJson(key: string, valor: unknown) {
  const payload = JSON.stringify(valor);
  await prisma.jsonStore.upsert({
    where: { key },
    create: { key, payload },
    update: { payload },
  });
}

async function semearPadroesVirgens() {
  await gravarJson(CONFIG_LAB_STORAGE_KEY, {
    ...CONFIG_LAB_PADRAO,
    tipoPessoa: "Jurídica",
  });
  await gravarJson(NFSE_CONFIG_KEY, NFSE_CONFIG_PADRAO);
  await gravarJson(ASAAS_CONFIG_KEY, ASAAS_CONFIG_PADRAO);
  await gravarJson(BACKUP_AUTOMATICO_CONFIG_KEY, CONFIG_BACKUP_AUTOMATICO_PADRAO);

  for (const [key, valor] of Object.entries(JSON_VAZIOS)) {
    await gravarJson(key, valor);
  }
}

async function main() {
  if (!confirmado()) {
    console.error(
      "Operação destrutiva bloqueada. Use: npx tsx scripts/zerar-sistema-virgem.ts --confirmar=ZERAR"
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  console.log(`[zerar] Banco alvo: ${hostBanco(dbUrl)}`);
  console.log("[zerar] Apagando todos os registros...");

  await prisma.cobrancaAsaas.deleteMany();
  await prisma.extratoMovimentacao.deleteMany();
  await prisma.movimentacaoConta.deleteMany();
  await prisma.contaBancaria.deleteMany();
  await prisma.lancamento.deleteMany();
  await prisma.nfseEmissao.deleteMany();
  await prisma.trabalho.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.orcamento.deleteMany();
  await prisma.logAuditoria.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.arquivoUpload.deleteMany();
  await prisma.sequenciaNumerica.deleteMany();
  await prisma.user.deleteMany();
  await prisma.jsonStore.deleteMany();

  console.log("[zerar] Limpando pastas locais (uploads, backups)...");
  await limparPastasLocais();

  const password = await bcrypt.hash(SENHA_PADRAO, 10);
  const proprietario = await prisma.user.create({
    data: {
      name: "Proprietário",
      email: EMAIL_PADRAO.toLowerCase(),
      password,
      role: "proprietario",
      moduloProducao: false,
    },
  });

  console.log("[zerar] Semeando configurações padrão vazias...");
  await semearPadroesVirgens();

  console.log("");
  console.log("Sistema zerado com sucesso.");
  console.log(`Proprietário: ${proprietario.email}`);
  console.log(`Senha: ${SENHA_PADRAO}`);
  console.log("Nenhum cliente, OS, produto ou financeiro cadastrado.");
}

main()
  .catch((erro) => {
    console.error("[zerar] Falha:", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
