#!/usr/bin/env node
/**
 * Envolve o conteúdo dos modais com <I18nPortal> para tradução automática via trUiArvore.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const IMPORT_LINE =
  'import { I18nPortal } from "@/components/I18nPortal";\n';

function listarModais(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next"].includes(entry.name)) continue;
      out.push(...listarModais(full));
    } else if (/Modal.*\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

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

function envolverCreatePortal(content) {
  return content.replace(
    /createPortal\(\s*\n?\s*(<(?:div|form)[\s\S]*?>[\s\S]*?<\/(?:div|form)>)\s*,\s*document\.body/g,
    (match, jsx) => {
      if (match.includes("<I18nPortal")) return match;
      return `createPortal(\n    <I18nPortal>\n      ${jsx.trim()}\n    </I18nPortal>,\n    document.body`;
    }
  );
}

function envolverOverlayFixo(content) {
  return content.replace(
    /return \(\s*\n\s*(<div className="fixed inset-0[\s\S]*?<\/div>\s*)\n\s*\);/g,
    (match, jsx) => {
      if (match.includes("<I18nPortal")) return match;
      return `return (\n    <I18nPortal>\n      ${jsx.trim()}\n    </I18nPortal>\n  );`;
    }
  );
}

let alterados = 0;
for (const file of listarModais(path.join(root, "src"))) {
  let content = fs.readFileSync(file, "utf8");
  if (content.includes("<I18nPortal")) continue;

  const original = content;
  content = adicionarImport(content);
  content = envolverCreatePortal(content);
  content = envolverOverlayFixo(content);

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    alterados++;
    console.log("OK", path.relative(root, file));
  }
}

console.log("Modais alterados:", alterados);
