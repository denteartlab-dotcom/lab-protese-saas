import { mkdir, rm } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { CONFIG_LAB_PADRAO, CONFIG_LAB_STORAGE_KEY } from "@/lib/configuracoes-lab";
import { ASAAS_CONFIG_KEY, ASAAS_CONFIG_PADRAO } from "@/lib/asaas-config";
import { NFSE_CONFIG_KEY, NFSE_CONFIG_PADRAO } from "@/lib/nfse-config";
import { garantirTabelaHistoricoEtapas } from "@/lib/historico-etapas";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import type { PastaUpload } from "@/lib/upload-arquivo-server";
import { caminhoPastaUploads } from "@/lib/uploads-armazenamento-server";
import {
  CONTAS_BANCARIAS_PADRAO,
  CONTAS_BANCARIAS_VERSION,
  CONTAS_BANCARIAS_VERSION_KEY,
  CONTAS_BANCARIAS_STORAGE_KEY,
  MOVIMENTACOES_CONTA_STORAGE_KEY,
} from "@/lib/conta-bancaria";
import { EXTRATO_BANCARIO_STORAGE_KEY } from "@/lib/extrato-bancario";
import {
  salvarContasBancariasServidor,
  salvarExtratoBancarioServidor,
  salvarMovimentacoesContaServidor,
} from "@/lib/conta-bancaria-servidor";

export type ModuloLimpezaId =
  | "financeiro"
  | "conta_bancaria"
  | "producao"
  | "clientes"
  | "orcamentos"
  | "produtos"
  | "tabela_precos"
  | "etapas"
  | "colaboradores"
  | "cadastros"
  | "integracoes"
  | "configuracoes"
  | "usuarios"
  | "auditoria"
  | "anexos"
  | "inicio"
  | "clientes_negativos"
  | "relatorio_financeiro_geral"
  | "dre";

export type ModuloLimpezaDef = {
  id: ModuloLimpezaId;
  label: string;
  descricao: string;
  /** Menor = apagado antes (dependências). */
  ordemExclusao: number;
  localStorageKeys: string[];
  /** Prefixos de chaves no localStorage (ex.: labProteseListaConfig:). */
  localStoragePrefixos?: string[];
  jsonStoreKeys?: string[];
  uploadPastas?: PastaUpload[];
};

export const MODULOS_LIMPEZA: ModuloLimpezaDef[] = [
  {
    id: "financeiro",
    label: "Financeiro",
    descricao:
      "Receitas, despesas, boletos Asaas, NFS-e emitidas, plano de contas e anexos de receitas/despesas.",
    ordemExclusao: 10,
    localStorageKeys: [
      "labProtesePlanoContas",
      "labProtesePlanoContasVersion",
    ],
    uploadPastas: ["despesas", "receitas"],
  },
  {
    id: "conta_bancaria",
    label: "Conta bancária",
    descricao:
      "Restaura Caixa Principal, Carteira Digital e Nota Fiscal ao padrão; remove movimentações e extrato. Não apaga receitas nem despesas.",
    ordemExclusao: 12,
    localStorageKeys: [
      CONTAS_BANCARIAS_STORAGE_KEY,
      CONTAS_BANCARIAS_VERSION_KEY,
      MOVIMENTACOES_CONTA_STORAGE_KEY,
      EXTRATO_BANCARIO_STORAGE_KEY,
    ],
  },
  {
    id: "dre",
    label: "D.R.E.",
    descricao:
      "Receitas e despesas já recebidas ou pagas (status Pago) usadas na D.R.E. Lançamentos pendentes são mantidos.",
    ordemExclusao: 11,
    localStorageKeys: [],
  },
  {
    id: "producao",
    label: "Produção / Ordens de Serviço",
    descricao: "Todas as OS, numeração sequencial e anexos vinculados à produção.",
    ordemExclusao: 20,
    localStorageKeys: ["labProteseProdutosEstoqueOsMovimentos"],
    uploadPastas: ["os"],
  },
  {
    id: "clientes_negativos",
    label: "Relatório Clientes Negativos",
    descricao:
      "Histórico de repetições de etapa, produto e serviço (retrabalho e prejuízo).",
    ordemExclusao: 21,
    localStorageKeys: [],
  },
  {
    id: "relatorio_financeiro_geral",
    label: "Relatório Financeiro Geral",
    descricao:
      "Mapa de etapas concluídas das OS usado no relatório. Valores e serviços vêm das ordens de serviço (módulo Produção).",
    ordemExclusao: 22,
    localStorageKeys: [MODULO_PRODUCAO_ETAPAS_STORAGE_KEY],
  },
  {
    id: "orcamentos",
    label: "Orçamentos",
    descricao: "Pedidos de orçamento enviados a fornecedores.",
    ordemExclusao: 30,
    localStorageKeys: ["labProteseOrcamentos", "labProteseLabTelefone"],
  },
  {
    id: "auditoria",
    label: "Logs de auditoria",
    descricao: "Histórico de alterações em OS e financeiro.",
    ordemExclusao: 35,
    localStorageKeys: [],
  },
  {
    id: "clientes",
    label: "Clientes e pacientes",
    descricao: "Cadastro de dentistas/clínicas e pacientes.",
    ordemExclusao: 40,
    localStorageKeys: [],
  },
  {
    id: "produtos",
    label: "Cadastros de produtos",
    descricao: "Produtos no banco e movimentações de estoque no navegador.",
    ordemExclusao: 50,
    localStorageKeys: [
      "labProteseProdutosEstoqueExtras",
      "labProteseProdutosEstoqueMovimentos",
      "labProteseProdutosEstoqueOsMovimentos",
      "labProteseProdutosRemovidosPermanentemente",
      "labProteseProdutosExcluidosSnapshots",
    ],
  },
  {
    id: "tabela_precos",
    label: "Tabela de preços",
    descricao: "Tabela de preços e itens de custo cadastrados.",
    ordemExclusao: 55,
    localStorageKeys: ["labProteseTabelaPrecos", "labProteseItensCustoCadastro"],
  },
  {
    id: "etapas",
    label: "Etapas e setores",
    descricao: "Etapas e setores cadastrados no sistema.",
    ordemExclusao: 56,
    localStorageKeys: [
      "labProteseEtapas",
      "labProteseEtapasExcluidas",
      "labProteseSetores",
      "labProteseSetoresExcluidos",
    ],
  },
  {
    id: "colaboradores",
    label: "Colaboradores e prestadores",
    descricao: "Colaboradores, prestadores e entregadores cadastrados.",
    ordemExclusao: 57,
    localStorageKeys: [
      "labProteseColaboradores",
      "labProteseColaboradoresExcluidos",
      "labProtesePrestadores",
      "labProtesePrestadoresExcluidos",
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros auxiliares",
    descricao:
      "Fornecedores, categorias de fornecedores e material do dentista (navegador).",
    ordemExclusao: 60,
    localStorageKeys: [
      "labProteseFornecedores",
      "labProteseFornecedoresExcluidos",
      "labProteseCategoriasFornecedores",
      "labProteseMateriaisDentista",
    ],
    localStoragePrefixos: ["labProteseListaConfig:"],
  },
  {
    id: "integracoes",
    label: "Integrações (NFS-e e Boletos)",
    descricao: "Chaves e tokens de NFS-e e Asaas salvos no servidor.",
    ordemExclusao: 70,
    localStorageKeys: [],
    jsonStoreKeys: [NFSE_CONFIG_KEY, ASAAS_CONFIG_KEY],
  },
  {
    id: "configuracoes",
    label: "Configurações do laboratório",
    descricao: "Dados do lab, logo, idioma e horário de funcionamento.",
    ordemExclusao: 80,
    localStorageKeys: ["labProteseHorarioFuncionamento", "labProteseLaboratorioId"],
    localStoragePrefixos: [CONFIG_LAB_STORAGE_KEY],
    jsonStoreKeys: [CONFIG_LAB_STORAGE_KEY],
  },
  {
    id: "usuarios",
    label: "Usuários do sistema",
    descricao: "Contas de acesso (exceto o seu usuário atual).",
    ordemExclusao: 90,
    localStorageKeys: [],
  },
  {
    id: "anexos",
    label: "Todos os anexos",
    descricao: "Imagens e PDFs de OS, despesas e receitas (banco e pasta uploads).",
    ordemExclusao: 15,
    localStorageKeys: [],
    uploadPastas: ["os", "despesas", "receitas"],
  },
  {
    id: "inicio",
    label: "Início / painel",
    descricao: "Anotações do dashboard, notificações e preferências de listagem.",
    ordemExclusao: 100,
    localStorageKeys: [
      "labProteseAnotacoesDashboard",
      "labProteseNotificacoesLidas",
      "labProteseNotificacoesDescartadas",
      "labProteseNotifSistema",
    ],
    localStoragePrefixos: ["labProteseListaConfig:"],
  },
];

export function moduloPorId(id: string): ModuloLimpezaDef | undefined {
  return MODULOS_LIMPEZA.find((m) => m.id === id);
}

export function idsModulosValidos(ids: string[]): ModuloLimpezaId[] {
  const set = new Set(MODULOS_LIMPEZA.map((m) => m.id));
  return ids.filter((id): id is ModuloLimpezaId => set.has(id as ModuloLimpezaId));
}

export function chavesLocalStorageModulos(ids: ModuloLimpezaId[]): string[] {
  const chaves = new Set<string>();
  const prefixos = new Set<string>();
  for (const id of ids) {
    const mod = moduloPorId(id);
    if (!mod) continue;
    mod.localStorageKeys.forEach((k) => chaves.add(k));
    mod.localStoragePrefixos?.forEach((p) => prefixos.add(p));
  }
  return [...chaves, ...prefixos];
}

/** Contagens no servidor (banco + arquivos em disco) — escopo de uma empresa. */
export async function contarRegistrosModulos(
  prisma: PrismaClient,
  empresaId: string
): Promise<Record<ModuloLimpezaId, number>> {
  const whereEmpresa = { empresaId };

  const [
    lancamentos,
    lancamentosPagos,
    cobrancas,
    nfse,
    trabalhos,
    orcamentos,
    clientes,
    pacientes,
    produtos,
    logs,
    usuarios,
    anexos,
    sequenciaOs,
    contasBancarias,
    movimentacoesConta,
    extratoBancario,
  ] = await Promise.all([
    prisma.lancamento.count({ where: whereEmpresa }),
    prisma.lancamento.count({ where: { ...whereEmpresa, status: "pago" } }),
    prisma.cobrancaAsaas.count({ where: { lancamento: whereEmpresa } }),
    prisma.nfseEmissao.count({ where: whereEmpresa }),
    prisma.trabalho.count({ where: whereEmpresa }),
    prisma.orcamento.count({ where: whereEmpresa }),
    prisma.cliente.count({ where: whereEmpresa }),
    prisma.paciente.count({ where: { cliente: whereEmpresa } }),
    prisma.produto.count({ where: whereEmpresa }),
    prisma.logAuditoria.count({ where: whereEmpresa }),
    prisma.user.count({ where: whereEmpresa }),
    prisma.arquivoUpload.count({ where: whereEmpresa }),
    prisma.sequenciaNumerica.count({ where: { empresaId, chave: "numero_os" } }),
    prisma.contaBancaria.count({ where: whereEmpresa }),
    prisma.movimentacaoConta.count({ where: { conta: whereEmpresa } }),
    prisma.extratoMovimentacao.count({ where: { conta: whereEmpresa } }),
  ]);

  const [jsonNfse, jsonAsaas, jsonLab, jsonEtapasModulo] = await Promise.all([
    lerJsonStoreTenant(empresaId, NFSE_CONFIG_KEY),
    lerJsonStoreTenant(empresaId, ASAAS_CONFIG_KEY),
    lerJsonStoreTenant(empresaId, CONFIG_LAB_STORAGE_KEY),
    lerJsonStoreTenant<Record<string, unknown>>(empresaId, MODULO_PRODUCAO_ETAPAS_STORAGE_KEY),
  ]);

  let historicoEtapas = 0;
  try {
    await garantirTabelaHistoricoEtapas();
    historicoEtapas = await prisma.historicoEtapa.count({ where: whereEmpresa });
  } catch {
    historicoEtapas = 0;
  }

  let etapasRelatorioFinanceiro = 0;
  if (jsonEtapasModulo && typeof jsonEtapasModulo === "object" && !Array.isArray(jsonEtapasModulo)) {
    etapasRelatorioFinanceiro = Object.keys(jsonEtapasModulo).length;
  }

  const integracoes = (jsonNfse ? 1 : 0) + (jsonAsaas ? 1 : 0);
  const configuracoes = jsonLab ? 1 : 0;

  return {
    financeiro: lancamentos + cobrancas + nfse,
    conta_bancaria: contasBancarias + movimentacoesConta + extratoBancario,
    dre: lancamentosPagos,
    producao: trabalhos + (sequenciaOs > 0 ? 1 : 0),
    clientes_negativos: historicoEtapas,
    relatorio_financeiro_geral: etapasRelatorioFinanceiro,
    clientes: clientes + pacientes,
    orcamentos,
    produtos,
    tabela_precos: 0,
    etapas: 0,
    colaboradores: 0,
    cadastros: 0,
    integracoes,
    configuracoes,
    usuarios,
    auditoria: logs,
    anexos,
    inicio: 0,
  };
}

async function excluirPastaUploads(pasta: PastaUpload, empresaSlug: string) {
  const dir = path.join(caminhoPastaUploads(empresaSlug), pasta);
  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  } catch {
    /* pasta pode não existir */
  }
}

async function excluirUploadsPastasComPrisma(
  prisma: PrismaClient,
  pastas: PastaUpload[],
  empresaId: string,
  empresaSlug: string
) {
  const unicas = [...new Set(pastas)];
  for (const pasta of unicas) {
    await prisma.arquivoUpload.deleteMany({ where: { pasta, empresaId } });
    await excluirPastaUploads(pasta, empresaSlug);
  }
}

export type ResultadoLimpezaModulos = {
  modulos: ModuloLimpezaId[];
  apagados: Record<string, number>;
  localStorageKeys: string[];
  localStoragePrefixos: string[];
  localStorageSet: Record<string, string>;
};

export async function limparModulosSelecionados(
  prisma: PrismaClient,
  ids: ModuloLimpezaId[],
  opts: { usuarioIdManter: string; empresaId: string }
): Promise<ResultadoLimpezaModulos> {
  const empresaId = opts.empresaId;
  const whereEmpresa = { empresaId };
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { slug: true },
  });
  const empresaSlug = empresa?.slug || empresaId;
  const ordenados = [...ids].sort(
    (a, b) =>
      (moduloPorId(a)?.ordemExclusao ?? 0) - (moduloPorId(b)?.ordemExclusao ?? 0)
  );

  const apagados: Record<string, number> = {};
  const localStorageSet: Record<string, string> = {};
  const pastasUpload: PastaUpload[] = [];
  const jsonKeys = new Set<string>();

  for (const id of ordenados) {
    const mod = moduloPorId(id);
    if (!mod) continue;
    mod.uploadPastas?.forEach((p) => pastasUpload.push(p));
    mod.jsonStoreKeys?.forEach((k) => jsonKeys.add(k));
  }

  for (const id of ordenados) {
    switch (id) {
      case "financeiro": {
        const c1 = await prisma.cobrancaAsaas.deleteMany({
          where: { lancamento: whereEmpresa },
        });
        const c2 = await prisma.nfseEmissao.deleteMany({ where: whereEmpresa });
        const c3 = await prisma.lancamento.deleteMany({ where: whereEmpresa });
        apagados.financeiro = c1.count + c2.count + c3.count;
        break;
      }
      case "conta_bancaria": {
        const c1 = await prisma.movimentacaoConta.deleteMany({
          where: { conta: whereEmpresa },
        });
        const c2 = await prisma.extratoMovimentacao.deleteMany({
          where: { conta: whereEmpresa },
        });
        await salvarContasBancariasServidor(empresaId, CONTAS_BANCARIAS_PADRAO);
        await salvarMovimentacoesContaServidor(empresaId, []);
        await salvarExtratoBancarioServidor(empresaId, []);
        apagados.conta_bancaria = c1.count + c2.count + CONTAS_BANCARIAS_PADRAO.length;
        localStorageSet[CONTAS_BANCARIAS_STORAGE_KEY] = JSON.stringify(
          CONTAS_BANCARIAS_PADRAO
        );
        localStorageSet[CONTAS_BANCARIAS_VERSION_KEY] = String(CONTAS_BANCARIAS_VERSION);
        localStorageSet[MOVIMENTACOES_CONTA_STORAGE_KEY] = "[]";
        localStorageSet[EXTRATO_BANCARIO_STORAGE_KEY] = "[]";
        break;
      }
      case "dre": {
        const c = await prisma.lancamento.deleteMany({
          where: { empresaId, status: "pago" },
        });
        apagados.dre = c.count;
        break;
      }
      case "producao": {
        const c1 = await prisma.trabalho.deleteMany({ where: whereEmpresa });
        await prisma.sequenciaNumerica.deleteMany({
          where: { empresaId, chave: "numero_os" },
        });
        apagados.producao = c1.count;
        break;
      }
      case "clientes_negativos": {
        await garantirTabelaHistoricoEtapas();
        const c = await prisma.historicoEtapa.deleteMany({ where: whereEmpresa });
        apagados.clientes_negativos = c.count;
        break;
      }
      case "relatorio_financeiro_geral": {
        localStorageSet[MODULO_PRODUCAO_ETAPAS_STORAGE_KEY] = "{}";
        await salvarJsonStoreTenant(empresaId, MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, {});
        apagados.relatorio_financeiro_geral = 1;
        break;
      }
      case "orcamentos": {
        const c = await prisma.orcamento.deleteMany({ where: whereEmpresa });
        apagados.orcamentos = c.count;
        break;
      }
      case "auditoria": {
        const c = await prisma.logAuditoria.deleteMany({ where: whereEmpresa });
        apagados.auditoria = c.count;
        break;
      }
      case "clientes": {
        const trabalhos = await prisma.trabalho.count({ where: whereEmpresa });
        const lancComCliente = await prisma.lancamento.count({
          where: { empresaId, clienteId: { not: null } },
        });
        if (trabalhos > 0 || lancComCliente > 0) {
          throw new Error(
            "Não é possível limpar clientes enquanto existirem OS ou lançamentos financeiros vinculados. Selecione também Produção e/ou Financeiro."
          );
        }
        await prisma.paciente.deleteMany({ where: { cliente: whereEmpresa } });
        const c = await prisma.cliente.deleteMany({ where: whereEmpresa });
        apagados.clientes = c.count;
        break;
      }
      case "produtos": {
        const c = await prisma.produto.deleteMany({ where: whereEmpresa });
        apagados.produtos = c.count;
        localStorageSet.labProteseProdutosExcluidos = "[]";
        localStorageSet.labProteseProdutosExcluidosSnapshots = "{}";
        localStorageSet.labProteseProdutosRemovidosPermanentemente = JSON.stringify([
          "padrao-brux",
          "padrao-deline",
          "padrao-estrutura",
          "padrao-investa",
          "padrao-newflex",
          "padrao-trilux",
        ]);
        localStorageSet.labProteseProdutosEstoqueExtras = "{}";
        localStorageSet.labProteseProdutosEstoqueMovimentos = "[]";
        localStorageSet.labProteseProdutosEstoqueOsMovimentos = "[]";
        break;
      }
      case "tabela_precos": {
        apagados.tabela_precos = 0;
        const payloadTabelaVazia = JSON.stringify({
          tabela: "Tabela Principal",
          tabelas: ["Tabela Principal"],
          categoriasPorTabela: { "Tabela Principal": [] },
        });
        localStorageSet.labProteseTabelaPrecos = payloadTabelaVazia;
        localStorageSet.labProteseItensCustoCadastro = "[]";
        await salvarJsonStoreTenant(empresaId, "labProteseTabelaPrecos", JSON.parse(payloadTabelaVazia));
        break;
      }
      case "etapas":
        apagados.etapas = 0;
        localStorageSet.labProteseEtapas = "[]";
        localStorageSet.labProteseEtapasExcluidas = "[]";
        localStorageSet.labProteseSetores = "[]";
        localStorageSet.labProteseSetoresExcluidos = "[]";
        break;
      case "colaboradores":
        apagados.colaboradores = 0;
        localStorageSet.labProteseColaboradores = "[]";
        localStorageSet.labProteseColaboradoresExcluidos = "[]";
        localStorageSet.labProtesePrestadores = "[]";
        localStorageSet.labProtesePrestadoresExcluidos = "[]";
        break;
      case "cadastros":
        apagados.cadastros = 0;
        localStorageSet.labProteseFornecedores = "[]";
        localStorageSet.labProteseFornecedoresExcluidos = "[]";
        localStorageSet.labProteseCategoriasFornecedores = "[]";
        localStorageSet.labProteseMateriaisDentista = "[]";
        break;
      case "integracoes": {
        await salvarJsonStoreTenant(empresaId, NFSE_CONFIG_KEY, NFSE_CONFIG_PADRAO);
        await salvarJsonStoreTenant(empresaId, ASAAS_CONFIG_KEY, ASAAS_CONFIG_PADRAO);
        apagados.integracoes = 2;
        break;
      }
      case "configuracoes": {
        const payload = {
          ...CONFIG_LAB_PADRAO,
          tipoPessoa: "Jurídica",
        };
        await salvarJsonStoreTenant(empresaId, CONFIG_LAB_STORAGE_KEY, payload);
        apagados.configuracoes = 1;
        break;
      }
      case "usuarios": {
        const c = await prisma.user.deleteMany({
          where: { empresaId, id: { not: opts.usuarioIdManter } },
        });
        apagados.usuarios = c.count;
        break;
      }
      case "anexos": {
        const c = await prisma.arquivoUpload.deleteMany({ where: whereEmpresa });
        apagados.anexos = c.count;
        for (const pasta of ["os", "despesas", "receitas"] as PastaUpload[]) {
          await excluirPastaUploads(pasta, empresaSlug);
        }
        break;
      }
      case "inicio":
        apagados.inicio = 0;
        break;
      default:
        break;
    }
  }

  if (pastasUpload.length > 0 && !ordenados.includes("anexos")) {
    await excluirUploadsPastasComPrisma(prisma, pastasUpload, empresaId, empresaSlug);
  }

  const lsKeys = chavesLocalStorageModulos(ids);
  const prefixos = new Set<string>();
  for (const id of ids) {
    moduloPorId(id)?.localStoragePrefixos?.forEach((p) => prefixos.add(p));
  }

  return {
    modulos: ids,
    apagados,
    localStorageKeys: lsKeys.filter((k) => !k.endsWith(":")),
    localStoragePrefixos: [...prefixos],
    localStorageSet,
  };
}
