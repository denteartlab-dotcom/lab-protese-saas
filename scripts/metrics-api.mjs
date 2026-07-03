#!/usr/bin/env node
/**
 * Lista top rotas lentas e mais chamadas (issue 001).
 * Requer servidor local: npm run dev:server
 *
 * Uso: npm run metrics:api
 *      npm run metrics:api -- --url http://127.0.0.1:3000
 */

const baseUrl = (() => {
  const idx = process.argv.indexOf("--url");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].replace(/\/$/, "");
  return process.env.METRICS_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
})();

function coluna(texto, largura) {
  const t = String(texto ?? "");
  return t.length >= largura ? t.slice(0, largura - 1) + "…" : t.padEnd(largura);
}

function imprimirTabela(titulo, linhas) {
  console.log(`\n${titulo}`);
  if (!linhas?.length) {
    console.log("  (sem dados — navegue no app com dev:server rodando)");
    return;
  }
  console.log(
    coluna("Método", 8) +
      coluna("Rota", 44) +
      coluna("Média", 8) +
      coluna("Máx", 8) +
      coluna("Cham.", 8) +
      coluna("Erros", 8)
  );
  for (const l of linhas) {
    console.log(
      coluna(l.metodo, 8) +
        coluna(l.rota, 44) +
        coluna(`${l.mediaMs}ms`, 8) +
        coluna(`${l.maxMs}ms`, 8) +
        coluna(l.chamadas, 8) +
        coluna(l.erros, 8)
    );
  }
}

async function main() {
  const url = `${baseUrl}/api/dev/metricas-api`;
  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    console.error(`Não foi possível conectar em ${url}`);
    console.error("Inicie o servidor com: npm run dev:server");
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`HTTP ${res.status}: ${body || url}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Métricas API — ${baseUrl}`);
  console.log(`Habilitado: ${data.habilitado ? "sim" : "não"} | Rotas distintas: ${data.rotasDistintas ?? 0}`);
  if (data.dica) console.log(data.dica);

  imprimirTabela("Top rotas por tempo médio", data.maisLentas);
  imprimirTabela("Top rotas por volume", data.maisChamadas);
}

main();
