import { escCsv } from "@/lib/exportar-csv";

export type OpcoesBaixarExcel = {
  nomeAba?: string;
  /** Índices de coluna (0-based) forçados como texto (CPF, telefone, CEP…). */
  colunasTexto?: number[];
};

function nomeArquivoXlsx(nomeArquivo: string) {
  const base = nomeArquivo.replace(/\.(xls|xlsx|csv)$/i, "").trim() || "planilha";
  return `${base}.xlsx`;
}

/** Exporta planilha .xlsx real (compatível com Excel e LibreOffice). */
export async function baixarExcel(
  nomeArquivo: string,
  colunas: string[],
  linhas: (string | number)[][],
  opcoes?: OpcoesBaixarExcel
) {
  const XLSX = await import("xlsx");
  const dados: string[][] = [
    colunas,
    ...linhas.map((linha) => linha.map((c) => String(c ?? ""))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(dados);

  if (opcoes?.colunasTexto?.length && ws["!ref"]) {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      for (const col of opcoes.colunasTexto) {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ws[addr];
        if (!cell) continue;
        cell.t = "s";
        cell.v = String(cell.v ?? "");
        cell.z = "@";
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opcoes?.nomeAba || "Dados");
  XLSX.writeFile(wb, nomeArquivoXlsx(nomeArquivo));
}

/** Reexporta helper CSV para uso conjunto. */
export { escCsv };
