import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";
import type { ColunaKanbanConfig, OrdemServicoTv } from "@/components/modulo-tv/types";
import { nomeEtapaSemSetor, type EtapaCadastro } from "@/lib/etapas-os";
import {
  corSetorPorNome,
  type SetorCadastro,
} from "@/lib/setores-cadastro";
import {
  etapasPadraoDoSetor,
  ETAPAS_OCULTAS_TV_POR_SETOR,
  ETAPAS_TV_FORCADAS_POR_SETOR,
  SETORES_PADRAO_TV,
} from "@/lib/tv/tv-setores-padrao";

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

/** Etapas do setor visíveis no kanban da TV (ex.: Gesso sem Acabamento). */
export function etapasVisiveisTvDoSetor(
  setorNome: string,
  etapas: EtapaCadastro[]
) {
  const chaveSetor = chaveNomeTv(setorNome);
  const listaCadastro = etapasCadastroDoSetor(setorNome, etapas);
  const forcadas = ETAPAS_TV_FORCADAS_POR_SETOR[chaveSetor];

  if (forcadas?.length) {
    return forcadas.map((nome) => {
      const chaveForcada = chaveNomeTv(nome);
      const existente =
        listaCadastro.find((etapa) => chaveNomeTv(etapa.nome) === chaveForcada) ||
        listaCadastro.find((etapa) =>
          etapaTvCompativelComColuna(etapa.nome, nome)
        );
      if (existente) {
        return { ...existente, nome };
      }
      return {
        id: `tv-forcada-${chaveSetor}-${chaveForcada.replace(/[^a-z0-9]+/g, "-")}`,
        nome,
        setor: setorNome,
      } satisfies EtapaCadastro;
    });
  }

  const ocultas = new Set(
    (ETAPAS_OCULTAS_TV_POR_SETOR[chaveSetor] || []).map((nome) =>
      chaveNomeTv(nome)
    )
  );
  if (ocultas.size === 0) return listaCadastro;
  return listaCadastro.filter((etapa) => !ocultas.has(chaveNomeTv(etapa.nome)));
}

/** Aceita "Aplicação" em coluna "Aplicação/Opaco" e vice-versa. */
export function etapaTvCompativelComColuna(
  nomeEtapaOrdem: string,
  nomeColuna: string
) {
  const a = chaveNomeTv(nomeEtapaOrdem);
  const b = chaveNomeTv(nomeColuna);
  if (!a || !b) return false;
  if (a === b) return true;
  const partesA = a.split(/[\/|,+-]+/).filter(Boolean);
  const partesB = b.split(/[\/|,+-]+/).filter(Boolean);
  if (partesA.some((p) => partesB.includes(p))) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/** Completa setores/etapas do cadastro com Gesso, CAD/CAM, Resina e Cerâmica. */
export function mesclarLayoutTvComPadroes(
  layout: TvLayoutSetores
): TvLayoutSetores {
  const setores: SetorCadastro[] = [...layout.setores];
  for (const padrao of SETORES_PADRAO_TV) {
    if (setores.some((item) => chaveNomeTv(item.nome) === chaveNomeTv(padrao.nome))) {
      continue;
    }
    setores.push(padrao);
  }

  const etapas: EtapaCadastro[] = [...layout.etapas];
  for (const setor of setores) {
    if (etapasCadastroDoSetor(setor.nome, etapas).length > 0) continue;
    etapas.push(...etapasPadraoDoSetor(setor.nome, chaveNomeTv(setor.nome)));
  }

  return { setores, etapas };
}

export function etapaAtualDaOrdemTv(ordem: OrdemServicoTv) {
  if (ordem.etapaNome?.trim()) return nomeEtapaSemSetor(ordem.etapaNome);
  const status = (ordem.status || "").split(" · ")[0] || "";
  return nomeEtapaSemSetor(status);
}

export function idColunaEtapaSetor(etapa: EtapaCadastro) {
  const base = (etapa.id || chaveNomeTv(etapa.nome) || "etapa").replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
  return `setor-etapa-${base}`;
}

export function idColunaSetorVista(setorNome: string) {
  return `setor-vista-${chaveNomeTv(setorNome) || "setor"}`;
}

function estiloColunaOutras(): Omit<ColunaKanbanConfig, "id" | "label"> {
  return {
    dot: "bg-slate-500",
    bar: "from-slate-500 to-slate-800",
    accent: "from-slate-600/[0.08] to-transparent",
    glow: "",
    border: "border-dashed border-slate-500/35",
    badge: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/25",
    ring: "ring-slate-500/8",
    variante: "outras",
  };
}

export function setorNomeDaOrdemTv(
  ordem: OrdemServicoTv,
  layout: TvLayoutSetores
) {
  const chaveSetor = chaveNomeTv(ordem.setor || "");
  if (chaveSetor) {
    const setor = layout.setores.find(
      (item) => chaveNomeTv(item.nome) === chaveSetor
    );
    if (setor) return setor.nome;
  }

  const chaveEtapa = chaveNomeTv(etapaAtualDaOrdemTv(ordem));
  if (!chaveEtapa) return "";
  const etapa = layout.etapas.find((item) => {
    if (!item.setor?.trim()) return false;
    return chaveNomeTv(item.nome) === chaveEtapa;
  });
  if (!etapa?.setor) return "";
  const setor = layout.setores.find(
    (item) => chaveNomeTv(item.nome) === chaveNomeTv(etapa.setor || "")
  );
  return setor?.nome ?? "";
}

export function colunaIdDaOrdemVisaoGeral(
  ordem: OrdemServicoTv,
  layout: TvLayoutSetores
) {
  const setor = setorNomeDaOrdemTv(ordem, layout);
  if (!setor) return ID_COLUNA_OUTRAS_SETOR;
  return idColunaSetorVista(setor);
}

export function montarColunasVisaoGeralTv(
  layout: TvLayoutSetores,
  labelSemSetor: string,
  ordens: OrdemServicoTv[] = []
): ColunaKanbanConfig[] {
  const colunas: ColunaKanbanConfig[] = layout.setores.map((setor, indice) => {
    const estilo = estiloColunaCiclo(indice);
    return {
      ...estilo,
      id: idColunaSetorVista(setor.nome),
      label: setor.nome.toUpperCase(),
      corHex: setor.cor || undefined,
      setorNome: setor.nome,
    };
  });

  const temSemSetor = ordens.some(
    (ordem) => colunaIdDaOrdemVisaoGeral(ordem, layout) === ID_COLUNA_OUTRAS_SETOR
  );
  if (temSemSetor || colunas.length === 0) {
    colunas.push({
      ...estiloColunaOutras(),
      id: ID_COLUNA_OUTRAS_SETOR,
      label: labelSemSetor.toUpperCase(),
    });
  }
  return colunas;
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
  const etapas = etapasVisiveisTvDoSetor(setorNome, layout.etapas);
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
    ...estiloColunaOutras(),
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

  const etapaAtual = etapaAtualDaOrdemTv(ordem);
  if (!chaveNomeTv(etapaAtual)) return false;
  return etapasVisiveisTvDoSetor(setorNome, layout.etapas).some((etapa) =>
    etapaTvCompativelComColuna(etapaAtual, etapa.nome)
  );
}

export function colunaIdOrdemNoSetorTv(
  ordem: OrdemServicoTv,
  setorNome: string,
  layout: TvLayoutSetores
) {
  const etapas = etapasVisiveisTvDoSetor(setorNome, layout.etapas);
  const chaveEtapa = chaveNomeTv(etapaAtualDaOrdemTv(ordem));
  if (chaveEtapa) {
    const etapa =
      etapas.find((item) => chaveNomeTv(item.nome) === chaveEtapa) ||
      etapas.find((item) =>
        etapaTvCompativelComColuna(etapaAtualDaOrdemTv(ordem), item.nome)
      );
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
  // Mantém o setor escolhido travado (sem voltar sozinho para "todos").
  return setor?.nome ?? valor;
}

export function idColunaDaOrdemNaVista(
  ordem: OrdemServicoTv,
  vista: string,
  layout: TvLayoutSetores
) {
  if (vista !== VISTA_TV_TODOS) {
    return colunaIdOrdemNoSetorTv(ordem, vista, layout);
  }
  return colunaIdDaOrdemVisaoGeral(ordem, layout);
}

export function colunasKanbanDaVista(
  vista: string,
  layout: TvLayoutSetores,
  rotulos: { outras: string; semSetor: string },
  ordensVista: OrdemServicoTv[] = []
): ColunaKanbanConfig[] {
  if (vista === VISTA_TV_TODOS) {
    return montarColunasVisaoGeralTv(layout, rotulos.semSetor, ordensVista);
  }
  const colunas = montarColunasDoSetorTv(vista, layout, rotulos.outras);
  const temOutras = ordensVista.some(
    (ordem) => colunaIdOrdemNoSetorTv(ordem, vista, layout) === ID_COLUNA_OUTRAS_SETOR
  );
  if (temOutras) return colunas;
  return colunas.filter((coluna) => coluna.id !== ID_COLUNA_OUTRAS_SETOR);
}
