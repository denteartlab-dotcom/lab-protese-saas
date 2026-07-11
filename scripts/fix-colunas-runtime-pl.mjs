#!/usr/bin/env node
/** Converte COLUNAS/COLUNAS_BASE de const para função (pl() após iniciarImpressao). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libDir = path.join(__dirname, "../src/lib");

const patterns = [
  {
    from: /const COLUNAS_BASE: ColDef\[\] = \[/g,
    to: "function colunasExtratoBase(): ColDef[] {\n  return [",
    close: /\];\n\nconst IDX_/g,
    closeTo: "];\n}\n\nconst IDX_",
  },
  {
    from: /const COLUNAS: ColunaRelatorioFaturasSmart\[\] = \[/g,
    to: "function colunasRelatorio(): ColunaRelatorioFaturasSmart[] {\n  return [",
    close: /\];\n\n(function|function |export )/g,
    closeTo: "];\n}\n\n$1",
  },
  {
    from: /const COLUNAS_MODELO1: ColunaComissaoPdf\[\] = \[/g,
    to: "function colunasComissaoModelo1(): ColunaComissaoPdf[] {\n  return [",
    close: /\];\n\nfunction desenharCabecalhoPagina/g,
    closeTo: "];\n}\n\nfunction desenharCabecalhoPagina",
  },
  {
    from: /const COLUNAS_MODELO2: ColunaComissaoPdf\[\] = \[/g,
    to: "function colunasComissaoModelo2(): ColunaComissaoPdf[] {\n  return [",
    close: /\];\n\nfunction desenharCabecalhoPagina/g,
    closeTo: "];\n}\n\nfunction desenharCabecalhoPagina",
  },
  {
    from: /const COLUNAS_AGRUPADO: ColunaAgrupadaPdf\[\] = \[/g,
    to: "function colunasComissaoAgrupado(): ColunaAgrupadaPdf[] {\n  return [",
    close: /\];\n\nfunction desenharCabecalhoPagina/g,
    closeTo: "];\n}\n\nfunction desenharCabecalhoPagina",
  },
];

const usageReplacements = [
  ["COLUNAS_BASE.reduce", "colunasExtratoBase().reduce"],
  ["COLUNAS_BASE.map", "colunasExtratoBase().map"],
  ["COLUNAS.map((c) => c.titulo)", "colunasRelatorio().map((c) => c.titulo)"],
  ["criarContextoTabelaFaturasSmart(pdf, COLUNAS)", "criarContextoTabelaFaturasSmart(pdf, colunasRelatorio())"],
  ["escalarColunasParaPaginaA4(COLUNAS_MODELO1", "escalarColunasParaPaginaA4(colunasComissaoModelo1("],
  ["escalarColunasParaPaginaA4(COLUNAS_MODELO2", "escalarColunasParaPaginaA4(colunasComissaoModelo2("],
  ["escalarColunas(COLUNAS_AGRUPADO", "escalarColunas(colunasComissaoAgrupado("],
];

const files = fs.readdirSync(libDir).filter((f) => f.startsWith("pdf-relatorio-") && f.endsWith(".ts"));

for (const file of files) {
  const full = path.join(libDir, file);
  let c = fs.readFileSync(full, "utf8");
  const orig = c;
  for (const p of patterns) {
    if (p.from.test(c)) {
      c = c.replace(p.from, p.to);
      c = c.replace(p.close, p.closeTo);
    }
  }
  for (const [from, to] of usageReplacements) {
    c = c.replaceAll(from, to);
  }
  if (c !== orig) {
    fs.writeFileSync(full, c);
    console.log("fixed", file);
  }
}
