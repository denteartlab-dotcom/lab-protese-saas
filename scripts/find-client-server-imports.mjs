import fs from "fs";
import path from "path";

const root = "src";
const serverMarkers = ['from "@/lib/db"', "node:async_hooks", "json-store-tenant"];
const files = [];

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(e.name)) files.push(p);
  }
}
walk(root);

const imports = new Map(
  files.map((f) => [
    f,
    [...fs.readFileSync(f, "utf8").matchAll(/from ["']@\/lib\/[^"']+["']/g)].map((m) =>
      m[0].slice(6, -1)
    ),
  ])
);

function resolveLib(importPath) {
  const rel = importPath.replace("@/lib/", "");
  const cands = [
    path.join("src/lib", `${rel}.ts`),
    path.join("src/lib", `${rel}.tsx`),
    path.join("src/lib", rel, "index.ts"),
  ];
  return cands.find((c) => fs.existsSync(c)) ?? null;
}

function traceToServer(file, seen = new Set(), chain = []) {
  if (seen.has(file)) return null;
  seen.add(file);
  const text = fs.readFileSync(file, "utf8");
  if (serverMarkers.some((m) => text.includes(m))) {
    return [...chain, file];
  }
  for (const imp of imports.get(file) ?? []) {
    const target = resolveLib(imp);
    if (!target) continue;
    const hit = traceToServer(target, new Set(seen), [...chain, `${file} <- ${imp}`]);
    if (hit) return hit;
  }
  return null;
}

for (const f of files) {
  if (!fs.readFileSync(f, "utf8").includes('"use client"')) continue;
  const chain = traceToServer(f);
  if (chain) {
    console.log("\n" + f);
    for (const step of chain) console.log("  " + step);
  }
}
