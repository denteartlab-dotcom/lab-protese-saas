export type TipoRepeticaoOs = "" | "etapa" | "produto" | "servico" | "etapa_produto";

export const OPCOES_TIPO_REPETICAO_OS: { value: TipoRepeticaoOs; label: string }[] = [
  { value: "", label: "Nenhuma" },
  { value: "etapa", label: "Etapa" },
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "etapa_produto", label: "Etapa / Produto" },
];

export function tipoRepeticaoIncluiEtapa(tipo: TipoRepeticaoOs) {
  return tipo === "etapa" || tipo === "etapa_produto";
}

export function tipoRepeticaoIncluiProduto(tipo: TipoRepeticaoOs) {
  return tipo === "produto" || tipo === "etapa_produto";
}

export function tipoRepeticaoIncluiServico(tipo: TipoRepeticaoOs) {
  return tipo === "servico";
}

export function labelMotivoRepeticaoManual(tipo: Exclude<TipoRepeticaoOs, "">) {
  const map: Record<Exclude<TipoRepeticaoOs, "">, string> = {
    etapa: "Repetição de etapa",
    produto: "Repetição de produto",
    servico: "Repetição de serviço",
    etapa_produto: "Repetição de etapa e produto",
  };
  return map[tipo];
}
