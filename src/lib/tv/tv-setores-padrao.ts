import type { EtapaCadastro } from "@/lib/etapas-os";
import type { SetorCadastro } from "@/lib/setores-cadastro";

/** Setores padrão da TV quando o cadastro ainda não tem lista. */
export const SETORES_PADRAO_TV: SetorCadastro[] = [
  { id: "tv-padrao-gesso", nome: "Gesso", cor: "#eab308" },
  { id: "tv-padrao-cadcam", nome: "CAD/CAM", cor: "#22d3ee" },
  { id: "tv-padrao-resina", nome: "Resina", cor: "#f97316" },
  { id: "tv-padrao-ceramica", nome: "Cerâmica", cor: "#a78bfa" },
];

/**
 * Colunas fixas do kanban da TV por setor (ordem exibida no painel).
 * Quando definido, prevalece sobre a lista do cadastro.
 */
export const ETAPAS_TV_FORCADAS_POR_SETOR: Record<string, string[]> = {
  gesso: ["Vazamento", "Articulação", "Acrilização"],
  ceramica: ["Aplicação/Opaco", "Acabamento", "Maquiagem/Glaze", "Emax/Injeção"],
  resina: [
    "Plano de cera",
    "Montagem",
    "Acabamento/Finalização",
    "CAD/CAM",
  ],
};

/** Etapas de cada setor (usadas se o cadastro do setor estiver vazio). */
export const ETAPAS_PADRAO_POR_SETOR: Record<string, string[]> = {
  gesso: ["Vazamento", "Articulação", "Acrilização"],
  "cad/cam": ["Escaneamento", "Desenho", "Impressão", "Fresagem"],
  resina: [
    "Plano de cera",
    "Montagem",
    "Acabamento/Finalização",
    "CAD/CAM",
  ],
  ceramica: ["Aplicação/Opaco", "Acabamento", "Maquiagem/Glaze", "Emax/Injeção"],
};

/** Etapas que não devem aparecer no kanban da TV (por setor). */
export const ETAPAS_OCULTAS_TV_POR_SETOR: Record<string, string[]> = {
  gesso: ["Acabamento"],
};

export function etapasPadraoDoSetor(
  setorNome: string,
  chaveSetor: string
): EtapaCadastro[] {
  const nomes =
    ETAPAS_TV_FORCADAS_POR_SETOR[chaveSetor] ??
    ETAPAS_PADRAO_POR_SETOR[chaveSetor] ??
    [];
  return nomes.map((nome) => ({
    id: `tv-padrao-${chaveSetor}-${nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")}`,
    nome,
    setor: setorNome,
  }));
}
