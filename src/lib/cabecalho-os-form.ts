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

import { configValueFromObservacoes } from "@/lib/cliente-financeiro";

export function clienteTabelaPrecoDeObservacoes(observacoes?: string | null) {
  return configValueFromObservacoes(observacoes, "Tabela de Preço:") || "Tabela Principal";
}

export function clienteDescontoGeralDeObservacoes(observacoes?: string | null) {
  return configValueFromObservacoes(observacoes, "Desconto Geral:");
}

export function clienteDescontoGeralTipoDeObservacoes(observacoes?: string | null) {
  const tipo = configValueFromObservacoes(observacoes, "Desconto Geral Tipo:");
  return tipo === "valor" ? "valor" : "percentual";
}

/** Usa o desconto do item; se zerado, aplica o desconto geral do cliente. */
export function descontoItemComFallbackCliente(
  descontoItem: string | undefined,
  descontoCliente: string
) {
  const item = descontoItem || "0,00";
  const digitos = item.replace(/[^\d]/g, "");
  if (!digitos || digitos === "000") {
    return descontoCliente || "0,00";
  }
  return item;
}

export function descontoZeradoPorTipo(descontoTipo?: string) {
  return descontoTipo === "valor" ? "R$ 0,00" : "0,00";
}

/** Com valor zerado, desconto fica 0% ou R$ 0,00 conforme o tipo. */
export function descontoItemResolvidoParaValor(
  valor: number,
  descontoItem: string | undefined,
  descontoCliente: string,
  descontoTipo?: string
) {
  if (!Number.isFinite(valor) || valor <= 0.009) {
    return descontoZeradoPorTipo(descontoTipo);
  }
  return descontoItemComFallbackCliente(descontoItem, descontoCliente);
}

export function descontoFormularioParaValorUn(
  valor: number,
  descontoTipo: string | undefined,
  descontoAtual: string | undefined,
  descontoCliente: string
) {
  if (!Number.isFinite(valor) || valor <= 0.009) {
    return descontoZeradoPorTipo(descontoTipo);
  }
  return descontoAtual || descontoCliente || descontoZeradoPorTipo(descontoTipo);
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
