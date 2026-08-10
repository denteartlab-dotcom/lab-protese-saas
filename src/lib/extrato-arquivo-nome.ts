const STORAGE_KEY = "labProteseExtratoPdfSequencia";

function limparSegmentoNomeArquivo(texto: string) {
  return texto
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

/** Título da aba / PDF viewer conforme o modelo (1, 2 ou 3). */
export function tituloViewerExtratoModelo(modelo: "1" | "2" | "3" | string): string {
  if (modelo === "2") return "Extrato Modelo 2";
  if (modelo === "3") return "Extrato Modelo 3";
  return "Extrato Modelo 1";
}

/** Próximo nome sequencial para salvar extrato (ex.: Extrato 1 - Apure Saude.pdf). */
export function proximoNomeArquivoExtratoPdf(clienteNome?: string | null): string {
  let proximo = 1;
  if (typeof window !== "undefined") {
    const atual = Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    proximo = Number.isFinite(atual) && atual >= 0 ? atual + 1 : 1;
    localStorage.setItem(STORAGE_KEY, String(proximo));
  }

  const cliente = limparSegmentoNomeArquivo(clienteNome ?? "");
  if (cliente) {
    return `Extrato ${proximo} - ${cliente}.pdf`;
  }
  return `Extrato ${proximo}.pdf`;
}
