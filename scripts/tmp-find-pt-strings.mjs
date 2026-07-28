import fs from "fs";

const files = [
  "src/app/app/clientes/page.tsx",
  "src/app/app/cadastros/colaboradores/page.tsx",
  "src/app/app/cadastros/fornecedores/page.tsx",
  "src/app/app/cadastros/prestadores/page.tsx",
  "src/app/app/cadastros/entregadores/page.tsx",
  "src/app/app/cadastros/setores/page.tsx",
  "src/app/app/cadastros/etapas/page.tsx",
  "src/app/app/cadastros/material-dentista/page.tsx",
  "src/app/app/cadastros/tabela-precos/page.tsx",
  "src/app/app/disparos-whatsapp/page.tsx",
  "src/app/app/disparos-whatsapp/historico/page.tsx",
];

for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  const found = new Set();
  for (const m of c.matchAll(/(?:label|title|placeholder|aria-label)=\{?"([^"{}]{3,80})"/g)) {
    if (!m[1].includes("t(")) found.add(m[1]);
  }
  for (const m of c.matchAll(/(?:label|title|placeholder|aria-label)="([^"]{3,80})"/g)) {
    found.add(m[1]);
  }
  for (const m of c.matchAll(/>([^<>{}\n]{3,60})</g)) {
    const s = m[1].trim();
    if (s && !s.includes("{") && /[À-ÿa-zA-Z]/.test(s)) found.add(s);
  }
  for (const m of c.matchAll(/alert\("([^"]+)"/g)) found.add(m[1]);
  const hard = [...found].filter(
    (s) =>
      !s.startsWith("cadastros.") &&
      !s.startsWith("nav.") &&
      !s.startsWith("listagem.") &&
      !/^[A-Z0-9_]+$/.test(s) &&
      !s.includes("className") &&
      s.length < 80
  );
  console.log(`\n=== ${f} (${hard.length}) ===`);
  hard.sort().forEach((s) => console.log(`  ${s}`));
}
