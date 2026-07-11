import fs from "fs";
import path from "path";

const strings = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full);
    } else if (/\.tsx?$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      const attrRe =
        /(?:label|placeholder|title|mensagem|emptyMessage|aria-label)=\{?"([^"]{2,100})"?\}/g;
      let m;
      while ((m = attrRe.exec(content))) strings.add(m[1]);
      const jsxRe = />([A-Za-zÀ-ú][^<>{}\n]{2,80})</g;
      while ((m = jsxRe.exec(content))) {
        const s = m[1].trim();
        if (!s.includes("{") && !s.startsWith("t(")) strings.add(s);
      }
    }
  }
}

walk("src");
const list = [...strings].sort();
console.log(list.join("\n"));
console.error("TOTAL:", list.length);
