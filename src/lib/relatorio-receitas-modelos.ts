/** Opções do select "Modelo Relatório" — espelho Smart Prótese. */

export const MODELOS_RELATORIO_RECEITAS = [
  { value: "faturas-modelo-1", label: "Faturas - Modelo 1" },
  { value: "faturas-modelo-2", label: "Faturas - Modelo 2 (parcelas)" },
  { value: "faturas-modelo-3", label: "Faturas - Modelo 3 (completo)" },
  { value: "parcelas-a-receber-modelo-1", label: "Parcelas (A Receber) Modelo 1" },
  { value: "parcelas-a-receber-modelo-2", label: "Parcelas (A Receber) Modelo 2" },
  { value: "recebimentos", label: "Recebimentos" },
  { value: "recebimentos-completo", label: "Recebimentos (completo)" },
  { value: "extrato-individual", label: "Extrato (Individual)" },
  { value: "extrato-2-individual", label: "Extrato 2 (Individual)" },
  { value: "extrato-3-agrupado-paciente", label: "Extrato 3 (Agrupado por Paciente)" },
] as const;

export type ModeloRelatorioReceitas =
  (typeof MODELOS_RELATORIO_RECEITAS)[number]["value"];

/** Labels PT de fallback; UI usa `labelModeloRelatorioReceitasI18n`. */
export function labelModeloRelatorioReceitas(modelo: ModeloRelatorioReceitas) {
  return (
    MODELOS_RELATORIO_RECEITAS.find((m) => m.value === modelo)?.label ?? modelo
  );
}

export function modeloEhFaturas(modelo: ModeloRelatorioReceitas) {
  return (
    modelo === "faturas-modelo-1" ||
    modelo === "faturas-modelo-2" ||
    modelo === "faturas-modelo-3"
  );
}

export function modeloEhParcelasAReceber(modelo: ModeloRelatorioReceitas) {
  return (
    modelo === "parcelas-a-receber-modelo-1" ||
    modelo === "parcelas-a-receber-modelo-2"
  );
}

export function modeloEhRecebimentos(modelo: ModeloRelatorioReceitas) {
  return modelo === "recebimentos" || modelo === "recebimentos-completo";
}

export function modeloEhExtratoIndividual(modelo: ModeloRelatorioReceitas) {
  return modelo === "extrato-individual";
}

export function modeloEhExtrato2Individual(modelo: ModeloRelatorioReceitas) {
  return modelo === "extrato-2-individual";
}

export function modeloEhExtrato3Paciente(modelo: ModeloRelatorioReceitas) {
  return modelo === "extrato-3-agrupado-paciente";
}

/** Extratos financeiros por cliente (exigem cliente selecionado). */
export function modeloEhExtratoPorCliente(modelo: ModeloRelatorioReceitas) {
  return (
    modeloEhExtratoIndividual(modelo) ||
    modeloEhExtrato2Individual(modelo) ||
    modeloEhExtrato3Paciente(modelo)
  );
}

export function modeloEhExtrato(modelo: ModeloRelatorioReceitas) {
  return modeloEhExtratoPorCliente(modelo);
}
