import { rm } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { CONFIG_LAB_PADRAO, CONFIG_LAB_STORAGE_KEY } from "@/lib/configuracoes-lab";
import { ASAAS_CONFIG_KEY, ASAAS_CONFIG_PADRAO } from "@/lib/asaas-config";
import { NFSE_CONFIG_KEY, NFSE_CONFIG_PADRAO } from "@/lib/nfse-config";
import type { PastaUpload } from "@/lib/upload-arquivo-server";

export type ModuloLimpezaId =
  | "financeiro"
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
  | "inicio";

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
      "Receitas, despesas, boletos Asaas, NFS-e emitidas, plano de contas, contas bancárias e anexos de receitas/despesas.",
    ordemExclusao: 10,
    localStorageKeys: [
      "labProtesePlanoContas",
      "labProtesePlanoContasVersion",
      "labProteseContasBancarias",
      "labProteseContasBancariasVersion",
      "labProteseMovimentacoesConta",
      "labProteseExtratoBancario",
    ],
    uploadPastas: ["despesas", "receitas"],
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

/** Contagens no servidor (banco + arquivos em disco). */
export async function contarRegistrosModulos(
  prisma: PrismaClient
): Promise<Record<ModuloLimpezaId, number>> {
  const [
    lancamentos,
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
  ] = await Promise.all([
    prisma.lancamento.count(),
    prisma.cobrancaAsaas.count(),
    prisma.nfseEmissao.count(),
    prisma.trabalho.count(),
    prisma.orcamento.count(),
    prisma.cliente.count(),
    prisma.paciente.count(),
    prisma.produto.count(),
    prisma.logAuditoria.count(),
    prisma.user.count(),
    prisma.arquivoUpload.count(),
    prisma.sequenciaNumerica.count({ where: { chave: "numero_os" } }),
  ]);

  const jsonNfse = await prisma.jsonStore.findUnique({ where: { key: NFSE_CONFIG_KEY } });
  const jsonAsaas = await prisma.jsonStore.findUnique({ where: { key: ASAAS_CONFIG_KEY } });
  const jsonLab = await prisma.jsonStore.findUnique({
    where: { key: CONFIG_LAB_STORAGE_KEY },
  });

  const integracoes =
    (jsonNfse?.payload?.trim() ? 1 : 0) + (jsonAsaas?.payload?.trim() ? 1 : 0);
  const configuracoes = jsonLab?.payload?.trim() ? 1 : 0;

  return {
    financeiro: lancamentos + cobrancas + nfse,
    producao: trabalhos + (sequenciaOs > 0 ? 1 : 0),
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

async function excluirPastaUploads(pasta: PastaUpload) {
  const dir = path.join(process.cwd(), "public", "uploads", pasta);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* pasta pode não existir */
  }
}

async function excluirUploadsPastasComPrisma(
  prisma: PrismaClient,
  pastas: PastaUpload[]
) {
  const unicas = [...new Set(pastas)];
  for (const pasta of unicas) {
    await prisma.arquivoUpload.deleteMany({ where: { pasta } });
    await excluirPastaUploads(pasta);
  }
}

export type ResultadoLimpezaModulos = {
  modulos: ModuloLimpezaId[];
  apagados: Record<string, number>;
  localStorageKeys: string[];
  localStoragePrefixos: string[];
};

export async function limparModulosSelecionados(
  prisma: PrismaClient,
  ids: ModuloLimpezaId[],
  opts: { usuarioIdManter: string }
): Promise<ResultadoLimpezaModulos> {
  const ordenados = [...ids].sort(
    (a, b) =>
      (moduloPorId(a)?.ordemExclusao ?? 0) - (moduloPorId(b)?.ordemExclusao ?? 0)
  );

  const apagados: Record<string, number> = {};
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
        const c1 = await prisma.cobrancaAsaas.deleteMany();
        const c2 = await prisma.nfseEmissao.deleteMany();
        const c3 = await prisma.lancamento.deleteMany();
        apagados.financeiro = c1.count + c2.count + c3.count;
        break;
      }
      case "producao": {
        const c1 = await prisma.trabalho.deleteMany();
        await prisma.sequenciaNumerica.deleteMany({ where: { chave: "numero_os" } });
        apagados.producao = c1.count;
        break;
      }
      case "orcamentos": {
        const c = await prisma.orcamento.deleteMany();
        apagados.orcamentos = c.count;
        break;
      }
      case "auditoria": {
        const c = await prisma.logAuditoria.deleteMany();
        apagados.auditoria = c.count;
        break;
      }
      case "clientes": {
        const trabalhos = await prisma.trabalho.count();
        const lancComCliente = await prisma.lancamento.count({
          where: { clienteId: { not: null } },
        });
        if (trabalhos > 0 || lancComCliente > 0) {
          throw new Error(
            "Não é possível limpar clientes enquanto existirem OS ou lançamentos financeiros vinculados. Selecione também Produção e/ou Financeiro."
          );
        }
        const c = await prisma.cliente.deleteMany();
        apagados.clientes = c.count;
        break;
      }
      case "produtos": {
        const c = await prisma.produto.deleteMany();
        apagados.produtos = c.count;
        break;
      }
      case "tabela_precos":
        apagados.tabela_precos = 0;
        break;
      case "etapas":
        apagados.etapas = 0;
        break;
      case "colaboradores":
        apagados.colaboradores = 0;
        break;
      case "cadastros":
        apagados.cadastros = 0;
        break;
      case "integracoes": {
        await prisma.jsonStore.upsert({
          where: { key: NFSE_CONFIG_KEY },
          create: {
            key: NFSE_CONFIG_KEY,
            payload: JSON.stringify(NFSE_CONFIG_PADRAO),
          },
          update: { payload: JSON.stringify(NFSE_CONFIG_PADRAO) },
        });
        await prisma.jsonStore.upsert({
          where: { key: ASAAS_CONFIG_KEY },
          create: {
            key: ASAAS_CONFIG_KEY,
            payload: JSON.stringify(ASAAS_CONFIG_PADRAO),
          },
          update: { payload: JSON.stringify(ASAAS_CONFIG_PADRAO) },
        });
        apagados.integracoes = 2;
        break;
      }
      case "configuracoes": {
        const payload = JSON.stringify({
          ...CONFIG_LAB_PADRAO,
          tipoPessoa: "Jurídica",
        });
        await prisma.jsonStore.upsert({
          where: { key: CONFIG_LAB_STORAGE_KEY },
          create: { key: CONFIG_LAB_STORAGE_KEY, payload },
          update: { payload },
        });
        apagados.configuracoes = 1;
        break;
      }
      case "usuarios": {
        const c = await prisma.user.deleteMany({
          where: { id: { not: opts.usuarioIdManter } },
        });
        apagados.usuarios = c.count;
        break;
      }
      case "anexos": {
        const c = await prisma.arquivoUpload.deleteMany();
        apagados.anexos = c.count;
        for (const pasta of ["os", "despesas", "receitas"] as PastaUpload[]) {
          await excluirPastaUploads(pasta);
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
    await excluirUploadsPastasComPrisma(prisma, pastasUpload);
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
  };
}
