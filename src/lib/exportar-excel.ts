import { escCsv } from "@/lib/exportar-csv";

/** Exporta planilha compatível com Microsoft Excel (HTML table). */
export function baixarExcel(
  nomeArquivo: string,
  colunas: string[],
  linhas: (string | number)[][]
) {
  const th = colunas.map((c) => `<th>${escHtml(c)}</th>`).join("");
  const rows = linhas
    .map(
      (linha) =>
        `<tr>${linha.map((c) => `<td>${escHtml(String(c ?? ""))}</td>`).join("")}</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Relatório</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></body></html>`;

  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".xls") ? nomeArquivo : `${nomeArquivo}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function escHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Reexporta helper CSV para uso conjunto. */
export { escCsv };
