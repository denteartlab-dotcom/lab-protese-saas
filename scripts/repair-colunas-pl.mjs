#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib");
const files = fs.readdirSync(libDir).filter((f) => f.startsWith("pdf-relatorio-") && f.endsWith(".ts"));

for (const file of files) {
  let c = fs.readFileSync(path.join(libDir, file), "utf8");
  const orig = c;

  c = c.replaceAll("colunasComissaoModelo1(,", "colunasComissaoModelo1(),");
  c = c.replaceAll("colunasComissaoModelo2(,", "colunasComissaoModelo2(),");
  c = c.replaceAll("colunasComissaoAgrupado(,", "colunasComissaoAgrupado(),");

  // Fecha function colunas* antes da próxima function
  c = c.replace(
    /(\n  \{ titulo: pl\([^}]+\},?\n)*\n\];\n\n(function )/g,
    (m) => m.replace("];\n\nfunction ", "];\n}\n\nfunction ")
  );

  // Remove stray } after CINZA_FUNDO
  c = c.replace(
    /const CINZA_FUNDO: \[number, number, number\] = \[238, 238, 238\];\n\}/g,
    "const CINZA_FUNDO: [number, number, number] = [238, 238, 238];"
  );

  // COLUNAS.map leftover
  c = c.replaceAll("COLUNAS.map", "colunasRelatorio().map");

  if (c !== orig) {
    fs.writeFileSync(path.join(libDir, file), c);
    console.log("repaired", file);
  }
}
