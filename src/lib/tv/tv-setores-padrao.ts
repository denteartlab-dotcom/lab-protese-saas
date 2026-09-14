import type { EtapaCadastro } from "@/lib/etapas-os";
import type { SetorCadastro } from "@/lib/setores-cadastro";

/** Setores padrão da TV quando o cadastro ainda não tem lista. */
export const SETORES_PADRAO_TV: SetorCadastro[] = [
  { id: "tv-padrao-gesso", nome: "Gesso", cor: "#eab308" },
  { id: "tv-padrao-cadcam", nome: "CAD/CAM", cor: "#22d3ee" },
  { id: "tv-padrao-resina", nome: "Resina", cor: "#f97316" },
  { id: "tv-padrao-ceramica", nome: "Cerâmica", cor: "#a78bfa" },
];

/** Etapas de cada setor (usadas se o cadastro do setor estiver vazio). */
export const ETAPAS_PADRAO_POR_SETOR: Record<string, string[]> = {
  gesso: ["Vazamento", "Articulação", "Acrilização", "Acabamento"],
  "cad/cam": ["Escaneamento", "Desenho", "Impressão", "Fresagem"],
  resina: ["Enceramento", "Inclusão", "Prensagem", "Acabamento"],
  ceramica: ["Aplicação", "Cocção", "Glaze", "Acabamento"],
};

export function etapasPadraoDoSetor(
  setorNome: string,
  chaveSetor: string
): EtapaCadastro[] {
  const nomes = ETAPAS_PADRAO_POR_SETOR[chaveSetor] ?? [];
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
