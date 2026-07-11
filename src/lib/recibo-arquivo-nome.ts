const STORAGE_KEY = "labProteseReciboPdfSequencia";

/** Próximo nome sequencial para salvar recibo (ex.: recibo 1.pdf, recibo 2.pdf). */
export function proximoNomeArquivoReciboPdf(): string {
  if (typeof window === "undefined") return "recibo 1.pdf";
  const atual = Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
  const proximo = Number.isFinite(atual) && atual >= 0 ? atual + 1 : 1;
  localStorage.setItem(STORAGE_KEY, String(proximo));
  return `recibo ${proximo}.pdf`;
}
