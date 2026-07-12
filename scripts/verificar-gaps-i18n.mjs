#!/usr/bin/env node
/** Lista textos JSX em PT que não estão no catálogo messages (pt). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function coletarValoresPt() {
  const vals = new Set();
  const ui = fs.readFileSync(
    path.join(root, "src/lib/i18n/messages-ui-auto.ts"),
    "utf8"
  );
  for (const m of ui.matchAll(/:\s*"((?:\\.|[^"\\])*)"/g)) {
    vals.add(JSON.parse(`"${m[1]}"`));
  }
  for (const file of [
    "messages.ts",
    "messages-modulos.ts",
    "messages-producao.ts",
    "messages-producao-submodulos.ts",
    "messages-financeiro.ts",
    "messages-print.ts",
    "messages-ui-auto.ts",
  ]) {
    const c = fs.readFileSync(path.join(root, "src/lib/i18n", file), "utf8");
    for (const m of c.matchAll(/:\s*"((?:\\.|[^"\\])*)"/g)) {
      try {
        vals.add(JSON.parse(`"${m[1]}"`));
      } catch {
        /* ignore */
      }
    }
  }
  return vals;
}

function walkStrings(dir, out = new Set()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next"].includes(entry.name)) continue;
      walkStrings(full, out);
    } else if (/\.tsx$/.test(full)) {
      const c = fs.readFileSync(full, "utf8");
      const patterns = [
        />([A-Za-zÀ-ú0-9][^<>{}\n]{2,100})</g,
        /\b(?:label|placeholder|title|mensagem|titulo|aviso|emptyMessage|aria-label)="([^"]{2,120})"/g,
        /\b(?:label|placeholder|title|mensagem|titulo|aviso)="([^']{2,120})'/g,
      ];
      for (const re of patterns) {
        let m;
        while ((m = re.exec(c))) {
          const s = m[1].trim();
          if (!s.includes("${") && !s.includes("t(") && !s.startsWith("{")) out.add(s);
        }
      }
    }
  }
  return out;
}

const catalogo = coletarValoresPt();
const jsx = walkStrings(path.join(root, "src"));
const faltando = [...jsx].filter((s) => !catalogo.has(s)).sort();
console.log("Catálogo PT:", catalogo.size);
console.log("Strings UI extraídas:", jsx.size);
console.log("Sem tradução no catálogo:", faltando.length);
faltando.slice(0, 50).forEach((s) => console.log("-", s));
