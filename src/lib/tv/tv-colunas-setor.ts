import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";
import type { ColunaKanbanConfig, OrdemServicoTv } from "@/components/modulo-tv/types";
import { nomeEtapaSemSetor, type EtapaCadastro } from "@/lib/etapas-os";
import {
  corSetorPorNome,
  type SetorCadastro,
} from "@/lib/setores-cadastro";

export const VISTA_TV_TODOS = "todos";
export const ID_COLUNA_OUTRAS_SETOR = "__setor_outras__";

export type TvLayoutSetores = {
  setores: SetorCadastro[];
  etapas: EtapaCadastro[];
};

export function chaveNomeTv(valor: string) {
  return nomeEtapaSemSetor(valor)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function etapasCadastroDoSetor(
  setorNome: string,
  etapas: EtapaCadastro[]
) {
  const chave = chaveNomeTv(setorNome);
  if (!chave) return [];
  const vistas = new Set<string>();
  const resultado: EtapaCadastro[] = [];
  for (const etapa of etapas) {
    if (chaveNomeTv(etapa.setor || "") !== chave) continue;
    const nomeChave = chaveNomeTv(etapa.nome);
    if (!nomeChave || vistas.has(nomeChave)) continue;
    vistas.add(nomeChave);
    resultado.push(etapa);
  }
  return resultado;
}

export function idColunaEtapaSetor(etapa: EtapaCadastro) {
  const base = (etapa.id || chaveNomeTv(etapa.nome) || "etapa").replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
  return `setor-etapa-${base}`;
}

function estiloColunaCiclo(indice: number): Omit<ColunaKanbanConfig, "id" | "label"> {
  const base = COLUNAS_KANBAN[indice % COLUNAS_KANBAN.length]!;
  const { id: _id, label: _label, ...resto } = base;
  return resto;
}

export function montarColunasDoSetorTv(
  setorNome: string,
  layout: TvLayoutSetores,
  labelOutras: string
): ColunaKanbanConfig[] {
  const etapas = etapasCadastroDoSetor(setorNome, layout.etapas);
  const corSetor = corSetorPorNome(setorNome, layout.setores);
  const colunas: ColunaKanbanConfig[] = etapas.map((etapa, indice) => {
    const estilo = estiloColunaCiclo(indice);
    const cor = (etapa.cor || "").trim() || corSetor;
    return {
      ...estilo,
      id: idColunaEtapaSetor(etapa),
      label: nomeEtapaSemSetor(etapa.nome).toUpperCase(),
      corHex: cor || undefined,
    };
  });

  colunas.push({
    ...estiloColunaCiclo(colunas.length),
    id: ID_COLUNA_OUTRAS_SETOR,
    label: labelOutras.toUpperCase(),
  });

  return colunas;
}

export function ordemVisivelNoSetorTv(
  ordem: OrdemServicoTv,
  setorNome: string,
  layout: TvLayoutSetores
) {
  const chaveSetor = chaveNomeTv(setorNome);
  if (!chaveSetor) return false;
  if (chaveNomeTv(ordem.setor || "") === chaveSetor) return true;

  const nomes = new Set(
    etapasCadastroDoSetor(setorNome, layout.etapas).map((etapa) =>
      chaveNomeTv(etapa.nome)
    )
  );
  return Boolean(ordem.etapaNome && nomes.has(chaveNomeTv(ordem.etapaNome)));
}

export function colunaIdOrdemNoSetorTv(
  ordem: OrdemServicoTv,
  setorNome: string,
  layout: TvLayoutSetores
) {
  const etapas = etapasCadastroDoSetor(setorNome, layout.etapas);
  const chaveEtapa = chaveNomeTv(ordem.etapaNome || "");
  if (chaveEtapa) {
    const etapa = etapas.find((item) => chaveNomeTv(item.nome) === chaveEtapa);
    if (etapa) return idColunaEtapaSetor(etapa);
  }
  return ID_COLUNA_OUTRAS_SETOR;
}

export function resolverSetorVistaTv(
  valor: string | null | undefined,
  setores: SetorCadastro[]
) {
  if (!valor || valor === VISTA_TV_TODOS) return VISTA_TV_TODOS;
  const chave = chaveNomeTv(valor);
  const setor = setores.find((item) => chaveNomeTv(item.nome) === chave);
  return setor?.nome ?? VISTA_TV_TODOS;
}

export function idColunaDaOrdemNaVista(
  ordem: OrdemServicoTv,
  vista: string,
  layout: TvLayoutSetores
) {
  if (vista === VISTA_TV_TODOS) return ordem.coluna;
  return colunaIdOrdemNoSetorTv(ordem, vista, layout);
}

export function colunasKanbanDaVista(
  vista: string,
  layout: TvLayoutSetores,
  labelOutras: string,
  ordensVista: OrdemServicoTv[] = []
): ColunaKanbanConfig[] {
  if (vista === VISTA_TV_TODOS) return COLUNAS_KANBAN;
  const colunas = montarColunasDoSetorTv(vista, layout, labelOutras);
  const temOutras = ordensVista.some(
    (ordem) => colunaIdOrdemNoSetorTv(ordem, vista, layout) === ID_COLUNA_OUTRAS_SETOR
  );
  if (temOutras) return colunas;
  return colunas.filter((coluna) => coluna.id !== ID_COLUNA_OUTRAS_SETOR);
}
