/** Normaliza nome para comparação (minúsculas, sem acentos, espaços únicos). */
export function normalizarNomePaciente(nome: string) {
  return nome
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Mesmo nome completo — diferença de maiúsculas/acentos não conta; sobrenomes extras sim. */
export function mesmosNomePacienteExato(a: string, b: string) {
  const na = normalizarNomePaciente(a);
  const nb = normalizarNomePaciente(b);
  return na.length >= 2 && na === nb;
}

export function nomePacienteProntoParaVerificacaoDuplicata(nome: string) {
  return normalizarNomePaciente(nome).length >= 2;
}
