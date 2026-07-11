#!/usr/bin/env node
/**
 * Envolve portais/overlays de visualização com I18nPortal.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const IMPORT_LINE =
  'import { I18nPortal } from "@/components/I18nPortal";\n';

const ALVOS = [
  "src/components/financeiro/VisualizadorAnexoDespesa.tsx",
  "src/components/dashboard/PdfViewerModal.tsx",
  "src/components/financeiro/FaturaPdfViewer.tsx",
  "src/components/pdf/PdfViewerIframe.tsx",
  "src/components/pdf/PdfViewerAmbiente.tsx",
];

function adicionarImport(content) {
  if (content.includes('from "@/components/I18nPortal"')) return content;
  const useClient = content.match(/^"use client";\s*\n/m);
  if (useClient) {
    const idx = useClient.index + useClient[0].length;
    return content.slice(0, idx) + IMPORT_LINE + content.slice(idx);
  }
  const firstImport = content.match(/^import .+;\s*\n/m);
  if (firstImport) {
    const idx = firstImport.index + firstImport[0].length;
    return content.slice(0, idx) + IMPORT_LINE + content.slice(idx);
  }
  return IMPORT_LINE + content;
}

let alterados = 0;
for (const rel of ALVOS) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf8");
  if (content.includes("<I18nPortal")) continue;
  const original = content;
  content = adicionarImport(content);
  content = content.replace(
    /return \(\s*\n\s*(<div className="fixed[\s\S]*?<\/div>\s*)\n\s*\);/,
    (match, jsx) => {
      if (match.includes("<I18nPortal")) return match;
      return `return (\n    <I18nPortal>\n      ${jsx.trim()}\n    </I18nPortal>\n  );`;
    }
  );
  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    alterados++;
    console.log("OK", rel);
  }
}
console.log("Visualizadores alterados:", alterados);
