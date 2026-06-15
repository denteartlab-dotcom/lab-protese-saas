/**
 * Verifica isolamento básico entre duas empresas no banco local.
 *
 * Uso:
 *   npm run db:testar-isolamento
 */
import { PrismaClient } from "@prisma/client";
import { chaveJsonStoreTenant } from "../src/lib/json-store-tenant";
import { ASAAS_CONFIG_KEY } from "../src/lib/asaas-config";
import { NFSE_CONFIG_KEY } from "../src/lib/nfse-config";

const prisma = new PrismaClient();

const SLUG_A = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";
const SLUG_B = process.env.EMPRESA_SLUG_TESTE?.trim() || "labteste";

type Falha = { teste: string; detalhe: string };

function ok(condicao: boolean, teste: string, detalhe: string, falhas: Falha[]) {
  if (!condicao) falhas.push({ teste, detalhe });
}

async function garantirEmpresaTeste() {
  let empresa = await prisma.empresa.findUnique({ where: { slug: SLUG_B } });
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: {
        nome: "Lab Teste Isolamento",
        slug: SLUG_B,
        plano: "basico",
        status: "ativo",
      },
    });
    console.log(`Empresa de teste criada: ${empresa.slug}`);
  }
  return empresa;
}

async function main() {
  console.log("Teste de isolamento multi-tenant\n");

  const falhas: Falha[] = [];

  const empresaA = await prisma.empresa.findUnique({ where: { slug: SLUG_A } });
  ok(Boolean(empresaA), "empresa_a", `Empresa "${SLUG_A}" não encontrada.`, falhas);
  if (!empresaA) {
    reportar(falhas);
    return;
  }

  const empresaB = await garantirEmpresaTeste();

  const contagens = async (empresaId: string) => {
    const [
      clientes,
      trabalhos,
      lancamentos,
      logs,
      historico,
      nfse,
      jsonTenant,
    ] = await Promise.all([
      prisma.cliente.count({ where: { empresaId } }),
      prisma.trabalho.count({ where: { empresaId } }),
      prisma.lancamento.count({ where: { empresaId } }),
      prisma.logAuditoria.count({ where: { empresaId } }),
      prisma.historicoEtapa.count({ where: { empresaId } }),
      prisma.nfseEmissao.count({ where: { empresaId } }),
      prisma.jsonStore.count({
        where: { key: { startsWith: `t:${empresaId}:` } },
      }),
    ]);
    return { clientes, trabalhos, lancamentos, logs, historico, nfse, jsonTenant };
  };

  const [a, b] = await Promise.all([
    contagens(empresaA.id),
    contagens(empresaB.id),
  ]);

  console.log(`${SLUG_A}:`, a);
  console.log(`${SLUG_B}:`, b);
  console.log("");

  const clientesCruzados = await prisma.cliente.count({
    where: {
      empresaId: empresaA.id,
      trabalhos: { some: { empresaId: empresaB.id } },
    },
  });
  ok(clientesCruzados === 0, "cliente_trabalho_cruzado", `${clientesCruzados} vínculo(s) cruzado(s).`, falhas);

  const logsSemEmpresa = await prisma.logAuditoria.count({ where: { empresaId: null } });
  const historicoSemEmpresa = await prisma.historicoEtapa.count({ where: { empresaId: null } });
  const nfseSemEmpresa = await prisma.nfseEmissao.count({ where: { empresaId: null } });

  ok(logsSemEmpresa === 0, "log_sem_empresa", `${logsSemEmpresa} log(s) sem empresaId.`, falhas);
  ok(
    historicoSemEmpresa === 0,
    "historico_sem_empresa",
    `${historicoSemEmpresa} histórico(s) sem empresaId.`,
    falhas
  );
  ok(nfseSemEmpresa === 0, "nfse_sem_empresa", `${nfseSemEmpresa} NFSe sem empresaId.`, falhas);

  const chaveAsaasA = chaveJsonStoreTenant(empresaA.id, ASAAS_CONFIG_KEY);
  const chaveAsaasB = chaveJsonStoreTenant(empresaB.id, ASAAS_CONFIG_KEY);
  const chaveNfseA = chaveJsonStoreTenant(empresaA.id, NFSE_CONFIG_KEY);
  const chaveNfseB = chaveJsonStoreTenant(empresaB.id, NFSE_CONFIG_KEY);

  const configsDistintas = [chaveAsaasA, chaveAsaasB, chaveNfseA, chaveNfseB];
  ok(
    new Set(configsDistintas).size === configsDistintas.length,
    "json_store_chaves_distintas",
    "Chaves JsonStore tenant devem ser únicas por empresa.",
    falhas
  );

  reportar(falhas);
}

function reportar(falhas: Falha[]) {
  if (falhas.length === 0) {
    console.log("OK — isolamento básico verificado.");
    process.exit(0);
  }

  console.error(`FALHOU — ${falhas.length} problema(s):`);
  for (const f of falhas) {
    console.error(`  • [${f.teste}] ${f.detalhe}`);
  }
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
