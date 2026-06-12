import { instrucoesTextoLivre } from "@/lib/etapas-os";

export type CabecalhoOsCampos = {
  dataLancamento: string;
  numeroOs: string;
  caixa: string;
  casoUrgente: string;
  pacienteNome: string;
  clienteId: string;
  dentista: string;
  material: string;
  observacoes: string;
};

export function linhaInstrucaoOs(instrucoes: string, prefixo: string) {
  const line = (instrucoes || "")
    .split("\n")
    .find((item) => item.trim().toLowerCase().startsWith(prefixo.toLowerCase()));
  if (!line) return "";
  const idx = line.indexOf(":");
  return idx >= 0 ? line.slice(idx + 1).trim() : "";
}

export function parseMateriaisEnviadosTexto(texto: string) {
  const selecionados: string[] = [];
  const quantidades: Record<string, number> = {};
  if (!texto.trim()) return { selecionados, quantidades };

  for (const part of texto.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)\s*\((\d+)\)\s*$/);
    if (match) {
      const nome = match[1].trim();
      selecionados.push(nome);
      quantidades[nome] = Number(match[2]) || 1;
    } else {
      selecionados.push(trimmed);
      quantidades[trimmed] = 1;
    }
  }
  return { selecionados, quantidades };
}

export function formatMateriaisEnviadosTexto(
  selecionados: string[],
  quantidades: Record<string, number>
) {
  return selecionados
    .map((material) => `${material} (${quantidades[material] || 1})`)
    .join(", ");
}

export function clienteTabelaPrecoDeObservacoes(observacoes?: string | null) {
  const texto = observacoes || "";
  const linha = texto
    .split("\n")
    .find((item) => item.startsWith("Tabela de Preço:"));
  return linha?.replace("Tabela de Preço:", "").trim() || "Tabela Principal";
}

export function montarCorpoCabecalhoInstrucoes(
  instrucoesCorpo: string,
  cabecalho: Pick<
    CabecalhoOsCampos,
    "caixa" | "dentista" | "casoUrgente" | "material"
  >,
  linhasAnexos = ""
) {
  const textoLivre = instrucoesTextoLivre(instrucoesCorpo);
  return [
    textoLivre,
    cabecalho.material ? `Material enviado: ${cabecalho.material}` : "",
    cabecalho.caixa ? `Caixa: ${cabecalho.caixa}` : "",
    cabecalho.dentista ? `Dentista: ${cabecalho.dentista}` : "",
    cabecalho.casoUrgente ? `Caso odontológico: ${cabecalho.casoUrgente}` : "",
    linhasAnexos,
  ]
    .filter(Boolean)
    .join("\n");
}

export function anexosParaLinhasInstrucoes(
  anexos: Array<{ name: string; type: string; url: string }>
) {
  return anexos
    .map((anexo) => `Arquivo anexado: ${anexo.name} | ${anexo.type} | ${anexo.url}`)
    .join("\n");
}
