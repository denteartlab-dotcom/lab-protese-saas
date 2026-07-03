import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  CONFIG_LAB_STORAGE_KEY,
  criarFormularioLaboratorioLimpo,
} from "@/lib/configuracoes-lab";
import { LAB_IMPRESSAO_PADRAO, LOGO_TAMANHO_PADRAO } from "@/lib/lab-impressao";
import { ETAPAS_STORAGE_KEY } from "@/lib/etapas-os";
import { MATERIAIS_DENTISTA_STORAGE_KEY } from "@/lib/materiais-dentista-cadastro";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import {
  PLANO_CONTAS_STORAGE_VERSION,
} from "@/lib/plano-contas";
import { salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { normalizarSlugEmpresa } from "@/lib/rotas-app";
import {
  TABELA_PRECOS_STORAGE_KEY,
  TABELA_PRECOS_VAZIA,
} from "@/lib/tabela-precos-os";
import { CORES_OS_STORAGE_KEY } from "@/lib/cores-os-cadastro";
import { ITENS_CUSTO_CADASTRO_KEY } from "@/lib/itens-custo-cadastro";
import { ETIQUETAS_CATEGORIA_STORAGE_KEY } from "@/lib/etiquetas-categoria";

export function configLaboratorioInicial(nomeEmpresa: string): ConfigLaboratorio {
  return {
    ...criarFormularioLaboratorioLimpo("Jurídica"),
    nomeLaboratorio: nomeEmpresa,
    marca: nomeEmpresa.trim() || LAB_IMPRESSAO_PADRAO.marca,
    marcaSubtitulo: "",
    email: "",
    // Conta nova: logo sempre vazio — nunca herdar da plataforma nem de outro tenant.
    logoDataUrl: "",
    logoTamanho: LOGO_TAMANHO_PADRAO,
  };
}

export async function gravarDadosPadraoEmpresa(
  empresaId: string,
  nomeEmpresa: string
) {
  await Promise.all([
    salvarJsonStoreTenant(empresaId, CONFIG_LAB_STORAGE_KEY, configLaboratorioInicial(nomeEmpresa)),
    salvarJsonStoreTenant(empresaId, ETAPAS_STORAGE_KEY, []),
    salvarJsonStoreTenant(empresaId, "labProteseEtapasExcluidas", []),
    salvarJsonStoreTenant(empresaId, MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, {}),
    salvarJsonStoreTenant(empresaId, "labProteseSetores", []),
    salvarJsonStoreTenant(empresaId, "labProteseSetoresExcluidos", []),
    salvarJsonStoreTenant(empresaId, "labProtesePlanoContas", []),
    salvarJsonStoreTenant(
      empresaId,
      "labProtesePlanoContasVersion",
      String(PLANO_CONTAS_STORAGE_VERSION)
    ),
    salvarJsonStoreTenant(empresaId, "labProteseColaboradores", []),
    salvarJsonStoreTenant(empresaId, "labProteseColaboradoresExcluidos", []),
    salvarJsonStoreTenant(empresaId, "labProteseFornecedores", []),
    salvarJsonStoreTenant(empresaId, "labProteseFornecedoresExcluidos", []),
    salvarJsonStoreTenant(empresaId, "labProteseCategoriasFornecedores", []),
    salvarJsonStoreTenant(empresaId, "labProtesePrestadores", []),
    salvarJsonStoreTenant(empresaId, "labProtesePrestadoresExcluidos", []),
    salvarJsonStoreTenant(empresaId, "labProteseEntregadores", []),
    salvarJsonStoreTenant(empresaId, "labProteseEntregadoresExcluidos", []),
    salvarJsonStoreTenant(empresaId, TABELA_PRECOS_STORAGE_KEY, TABELA_PRECOS_VAZIA),
    salvarJsonStoreTenant(empresaId, "labProteseProdutosEstoqueExtras", {}),
    salvarJsonStoreTenant(empresaId, "labProteseProdutosExcluidos", []),
    salvarJsonStoreTenant(empresaId, "labProteseProdutosRemovidosPermanentemente", []),
    salvarJsonStoreTenant(empresaId, MATERIAIS_DENTISTA_STORAGE_KEY, []),
    salvarJsonStoreTenant(empresaId, CORES_OS_STORAGE_KEY, []),
    salvarJsonStoreTenant(empresaId, ITENS_CUSTO_CADASTRO_KEY, []),
    salvarJsonStoreTenant(empresaId, ETIQUETAS_CATEGORIA_STORAGE_KEY, []),
  ]);
}

export function validarSlugEmpresa(slug: string): string | null {
  const normalizado = normalizarSlugEmpresa(slug);
  if (normalizado.length < 3 || normalizado.length > 40) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizado)) return null;
  return normalizado;
}
