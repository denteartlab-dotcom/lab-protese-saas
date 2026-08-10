const STORAGE_KEY = "labProteseReciboPdfSequencia";

function limparSegmentoNomeArquivo(texto: string) {
  return texto
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

/** Próximo nome sequencial para salvar recibo (ex.: Recibo 1 - Joao Piski.pdf). */
export function proximoNomeArquivoReciboPdf(clienteNome?: string | null): string {
  let proximo = 1;
  if (typeof window !== "undefined") {
    const atual = Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    proximo = Number.isFinite(atual) && atual >= 0 ? atual + 1 : 1;
    localStorage.setItem(STORAGE_KEY, String(proximo));
  }

  const cliente = limparSegmentoNomeArquivo(clienteNome ?? "");
  if (cliente) {
    return `Recibo ${proximo} - ${cliente}.pdf`;
  }
  return `Recibo ${proximo}.pdf`;
}
