/**
 * Inventário de modais e chamadas fetch/apiFetch por arquivo.
 * Uso: node scripts/inventario-modais.mjs
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

const MODULO_POR_CAMINHO = [
  { re: /dashboard/i, modulo: "5.2 Dashboard" },
  { re: /financeiro/i, modulo: "5.4 Financeiro" },
  { re: /producao|trabalhos|ImprimirOs|modulo-tv/i, modulo: "5.3 Produção" },
  { re: /clientes|colaboradores|fornecedores|prestadores|entregador|tabela-precos|etapas|setores|material-dentista|cadastros/i, modulo: "5.6 Cadastros" },
  { re: /produtos|orcamentos|estoque/i, modulo: "5.5 Estoque" },
  { re: /relatorios|Relatorio|Dre|CurvaAbc|Auditoria/i, modulo: "5.7 Relatórios" },
  { re: /configuracoes|configuracoes/i, modulo: "5.8 Configurações" },
  { re: /assinatura/i, modulo: "3 SaaS / Assinatura" },
  { re: /app-shell|LeitorCodigo|Confirmacao/i, modulo: "5.2 Shell / Global" },
];

function inferirModulo(filePath) {
  const rel = filePath.replace(/\\/g, "/");
  for (const { re, modulo } of MODULO_POR_CAMINHO) {
    if (re.test(rel)) return modulo;
  }
  return "Outros";
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      await walk(full, acc);
    } else if (e.name.endsWith(".tsx") && /Modal/i.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function extrairApis(conteudo) {
  const apis = new Set();
  const re = /(?:fetch|apiFetch)\s*(?:<[^>]*>)?\s*\(\s*[`'"](\/api[^`'"]+)[`'"]/g;
  let m;
  while ((m = re.exec(conteudo)) !== null) {
    apis.add(m[1].split("?")[0]);
  }
  const re2 = /[`'"](\/api\/[^`'"]+)[`'"]/g;
  while ((m = re2.exec(conteudo)) !== null) {
    if (conteudo.slice(Math.max(0, m.index - 20), m.index).includes("fetch")) continue;
    apis.add(m[1].split("?")[0]);
  }
  return [...apis].sort();
}

async function main() {
  const modais = await walk(SRC);
  const linhas = [];

  for (const file of modais.sort()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const conteudo = await readFile(file, "utf8");
    const apis = extrairApis(conteudo);
    linhas.push({
      arquivo: rel,
      nome: path.basename(file),
      modulo: inferirModulo(rel),
      apis: apis.length ? apis.join(", ") : "—",
      qtdApis: apis.length,
    });
  }

  const porModulo = {};
  for (const l of linhas) {
    porModulo[l.modulo] = (porModulo[l.modulo] || 0) + 1;
  }

  const md = [
    "# Inventário de modais",
    "",
    `Gerado em: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Comando: `node scripts/inventario-modais.mjs`",
    "",
    "## Resumo por módulo (PRD)",
    "",
    "| Módulo | Qtd modais |",
    "|--------|------------|",
    ...Object.entries(porModulo)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `| ${m} | ${n} |`),
    "",
    `**Total:** ${linhas.length} modais`,
    "",
    "## Detalhe",
    "",
    "| Arquivo | Módulo | APIs detectadas |",
    "|---------|--------|-----------------|",
    ...linhas.map(
      (l) => `| \`${l.arquivo}\` | ${l.modulo} | ${l.apis} |`
    ),
    "",
    "## Próximos candidatos a unificar (manual)",
    "",
    "- **Financeiro:** modais de PDF → issue 010",
    "- **Relatórios:** viewers PDF → issues 015 + 010",
    "- **Shell:** busca OS + leitor → issue 019",
    "- **Cadastros:** imports Excel → issue 012",
    "",
  ].join("\n");

  const outDir = path.join(ROOT, "docs", "issues");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "inventario-modais.md");
  await writeFile(outPath, md, "utf8");
  console.log(`OK: ${linhas.length} modais → ${outPath}`);
  console.log("Por módulo:", porModulo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
