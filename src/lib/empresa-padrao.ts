import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { CONFIG_LAB_PADRAO, CONFIG_LAB_STORAGE_KEY } from "@/lib/configuracoes-lab";
import { ETAPAS_STORAGE_KEY } from "@/lib/etapas-os";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import { salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { normalizarSlugEmpresa } from "@/lib/rotas-app";
import {
  TABELA_PRECOS_STORAGE_KEY,
  TABELA_PRECOS_VAZIA,
} from "@/lib/tabela-precos-os";

export function configLaboratorioInicial(nomeEmpresa: string): ConfigLaboratorio {
  return {
    ...CONFIG_LAB_PADRAO,
    nomeLaboratorio: nomeEmpresa,
    nomeFantasia: nomeEmpresa,
    razaoSocial: nomeEmpresa,
    tipoPessoa: "Jurídica",
    email: "",
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
  ]);
}

export function validarSlugEmpresa(slug: string): string | null {
  const normalizado = normalizarSlugEmpresa(slug);
  if (normalizado.length < 3 || normalizado.length > 40) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizado)) return null;
  return normalizado;
}
