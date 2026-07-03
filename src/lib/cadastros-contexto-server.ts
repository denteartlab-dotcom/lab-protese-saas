import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { SETORES_STORAGE_KEY, filtrarSetoresCadastro } from "@/lib/setores-cadastro";
import {
  CATEGORIAS_FORNECEDORES_STORAGE_KEY,
} from "@/lib/fornecedores-cadastro";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import {
  PLANO_CONTAS_PADRAO,
  PLANO_CONTAS_STORAGE_KEY,
  contasAnaliticasPlano,
  type ItemPlanoContas,
} from "@/lib/plano-contas";
import type { TipoContextoCadastro } from "@/lib/cadastros-contexto-schema";

async function carregarEtapasProducao(empresaId: string) {
  const mapa = await lerJsonStoreTenant<Record<string, number[]>>(
    empresaId,
    MODULO_PRODUCAO_ETAPAS_STORAGE_KEY
  );
  const nomes = new Set<string>();
  if (mapa) {
    for (const indices of Object.values(mapa)) {
      for (const idx of indices) nomes.add(String(idx));
    }
  }
  return Array.from(nomes);
}

export async function montarContextoCadastro(
  empresaId: string,
  tipo: TipoContextoCadastro
) {
  if (tipo === "colaborador") {
    const [setoresRaw, etapas] = await Promise.all([
      lerJsonStoreTenant<unknown[]>(empresaId, SETORES_STORAGE_KEY),
      carregarEtapasProducao(empresaId),
    ]);
    const setores = filtrarSetoresCadastro(
      Array.isArray(setoresRaw) ? (setoresRaw as Parameters<typeof filtrarSetoresCadastro>[0]) : []
    );

    return {
      tipo,
      setores,
      etapasProducao: etapas,
      comissaoDefaults: {
        percentual: "10,00",
        repeticao: "8,00",
        tipoContratacao: "Salário + Comissão",
      },
    };
  }

  const [categoriasRaw, planoItensRaw] = await Promise.all([
    lerJsonStoreTenant<string[]>(empresaId, CATEGORIAS_FORNECEDORES_STORAGE_KEY),
    lerJsonStoreTenant<ItemPlanoContas[]>(empresaId, PLANO_CONTAS_STORAGE_KEY),
  ]);

  const categorias = Array.isArray(categoriasRaw)
    ? categoriasRaw.filter((c) => String(c).trim())
    : [];

  const planoItens =
    Array.isArray(planoItensRaw) && planoItensRaw.length > 0
      ? planoItensRaw
      : PLANO_CONTAS_PADRAO;
  const contasDespesa = contasAnaliticasPlano(planoItens, "despesas");

  return {
    tipo,
    categorias,
    planoContasDespesa: contasDespesa,
  };
}
