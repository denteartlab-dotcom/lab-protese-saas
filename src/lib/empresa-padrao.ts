import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { CONFIG_LAB_PADRAO, CONFIG_LAB_STORAGE_KEY } from "@/lib/configuracoes-lab";
import { ETAPAS_STORAGE_KEY, type EtapaCadastro } from "@/lib/etapas-os";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import { salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { normalizarSlugEmpresa } from "@/lib/rotas-app";

export const ETAPAS_PADRAO_EMPRESA: EtapaCadastro[] = [
  { id: "entrada", nome: "ENTRADA", setor: "Entrada", cor: "#dbeafe" },
  { id: "plano-de-cera", nome: "PLANO DE CERA", setor: "Modelagem", cor: "#fef3c7" },
  { id: "montagem", nome: "MONTAGEM", setor: "Montagem", cor: "#fce7f3" },
  { id: "acrilizacao", nome: "ACRILIZAÇÃO", setor: "Acrilização", cor: "#e0e7ff" },
  { id: "acabamento", nome: "ACABAMENTO", setor: "Acabamento", cor: "#d1fae5" },
  { id: "pronto-entrega", nome: "PRONTO/ENTREGA", setor: "Entrega", cor: "#bbf7d0" },
];

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
    salvarJsonStoreTenant(empresaId, ETAPAS_STORAGE_KEY, ETAPAS_PADRAO_EMPRESA),
    salvarJsonStoreTenant(empresaId, MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, {}),
    salvarJsonStoreTenant(empresaId, "labProteseSetores", [
      { id: "entrada", nome: "Entrada", cor: "#dbeafe" },
      { id: "modelagem", nome: "Modelagem", cor: "#fef3c7" },
      { id: "montagem", nome: "Montagem", cor: "#fce7f3" },
      { id: "acrilizacao", nome: "Acrilização", cor: "#e0e7ff" },
      { id: "acabamento", nome: "Acabamento", cor: "#d1fae5" },
      { id: "entrega", nome: "Entrega", cor: "#bbf7d0" },
    ]),
    salvarJsonStoreTenant(empresaId, "labProtesePlanoContas", []),
    salvarJsonStoreTenant(empresaId, "labProteseColaboradores", []),
    salvarJsonStoreTenant(empresaId, "labProteseFornecedores", []),
  ]);
}

export function validarSlugEmpresa(slug: string): string | null {
  const normalizado = normalizarSlugEmpresa(slug);
  if (normalizado.length < 3 || normalizado.length > 40) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizado)) return null;
  return normalizado;
}
