#!/usr/bin/env node
/** Auditoria completa de i18n: gaps no catálogo, EN=PT fracos, páginas sem useI18n. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const MSG_FILES = [
  "messages.ts",
  "messages-modulos.ts",
  "messages-producao.ts",
  "messages-producao-submodulos.ts",
  "messages-financeiro.ts",
  "messages-print.ts",
  "messages-ui-auto.ts",
];

function coletarValoresPt() {
  const vals = new Set();
  for (const file of MSG_FILES) {
    const full = path.join(root, "src/lib/i18n", file);
    if (!fs.existsSync(full)) continue;
    const c = fs.readFileSync(full, "utf8");
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
        /alert\(\s*"([^"]{4,200})"/g,
      ];
      for (const re of patterns) {
        let m;
        while ((m = re.exec(c))) {
          const s = m[1].trim();
          if (
            !s.includes("${") &&
            !s.includes("t(") &&
            !s.startsWith("{") &&
            !/^[A-Z_0-9.]+$/.test(s)
          ) {
            out.add(s);
          }
        }
      }
    }
  }
  return out;
}

function paginasSemUseI18n() {
  const appDir = path.join(root, "src/app");
  const faltando = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx" || entry.name.endsWith("Form.tsx")) {
        const c = fs.readFileSync(full, "utf8");
        if (!c.includes("useI18n") && !c.includes("getServerSideProps")) {
          const hasPt = /[àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]/.test(c) || /"(?:Salvar|Cancelar|Buscar|Carregando|Excluir)"/.test(c);
          if (hasPt) faltando.push(path.relative(root, full));
        }
      }
    }
  }
  walk(appDir);
  return faltando;
}

function contarEnIgualPt() {
  const ui = fs.readFileSync(path.join(root, "src/lib/i18n/messages-ui-auto.ts"), "utf8");
  const ptBlock = ui.match(/export const messagesUiAutoPt = \{([\s\S]*?)\} as const/)?.[1] ?? "";
  const enBlock = ui.match(/export const messagesUiAutoEn = \{([\s\S]*?)\} as const/)?.[1] ?? "";
  const parse = (block) => {
    const o = {};
    for (const m of block.matchAll(/"(ui\.auto\.[^"]+)":\s*"((?:\\.|[^"\\])*)"/g)) {
      try {
        o[m[1]] = JSON.parse(`"${m[1].slice(0, 0)}${m[2]}"`.replace(/^""/, `"${m[2]}"`));
      } catch {
        o[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n");
      }
    }
    return o;
  };
  const kv = (block) => {
    const o = {};
    for (const m of block.matchAll(/"(ui\.auto\.[^"]+)":\s*"((?:\\.|[^"\\])*)"/g)) {
      o[m[1]] = JSON.parse(`"${m[2].replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    }
    return o;
  };
  let pt, en;
  try {
    pt = kv(ptBlock);
    en = kv(enBlock);
  } catch (e) {
    console.log("Erro parse ui.auto:", e.message);
    return { same: 0, total: 0 };
  }
  let same = 0;
  for (const k of Object.keys(pt)) {
    if (en[k] === pt[k]) same++;
  }
  return { same, total: Object.keys(pt).length };
}

const catalogo = coletarValoresPt();
const jsx = walkStrings(path.join(root, "src"));
const faltando = [...jsx].filter((s) => !catalogo.has(s)).sort();
const paginas = paginasSemUseI18n();
const enPt = contarEnIgualPt();

console.log("=== AUDITORIA i18n ===\n");
console.log("Catálogo PT (todas messages):", catalogo.size);
console.log("Strings UI em TSX:", jsx.size);
console.log("Sem chave no catálogo:", faltando.length);
faltando.slice(0, 40).forEach((s) => console.log("  -", s));
console.log("\nui.auto EN idêntico ao PT:", enPt.same, "/", enPt.total);
console.log("\nPáginas com PT mas sem useI18n:", paginas.length);
paginas.forEach((p) => console.log("  -", p));
