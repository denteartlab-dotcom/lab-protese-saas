/** Normaliza nome para comparação (minúsculas, sem acentos, espaços únicos). */
export function normalizarNomePaciente(nome: string) {
  return nome
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Primeira palavra = nome; última palavra = sobrenome. */
export function extrairNomeSobrenomePaciente(nomeCompleto: string) {
  const partes = normalizarNomePaciente(nomeCompleto).split(" ").filter(Boolean);
  if (partes.length < 2) return null;
  return { nome: partes[0], sobrenome: partes[partes.length - 1] };
}

export function nomePacienteProntoParaVerificacaoDuplicata(nome: string) {
  return extrairNomeSobrenomePaciente(nome) !== null;
}

export function mesmosNomeSobrenomePaciente(a: string, b: string) {
  const pa = extrairNomeSobrenomePaciente(a);
  const pb = extrairNomeSobrenomePaciente(b);
  if (!pa || !pb) return false;
  return pa.nome === pb.nome && pa.sobrenome === pb.sobrenome;
}
