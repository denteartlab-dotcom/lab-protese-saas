export function escCsv(valor: string | number) {
  const texto = String(valor ?? "");
  if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function baixarCsv(
  nomeArquivo: string,
  colunas: string[],
  linhas: (string | number)[][]
) {
  const header = colunas.map(escCsv).join(";");
  const rows = linhas.map((linha) => linha.map(escCsv).join(";"));
  const csv = ["\uFEFF", header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
