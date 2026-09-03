import { mapearNomeEtapaParaColuna } from "../src/lib/tv/tv-trabalhos-servidor";

const casos: Array<[string, string]> = [
  ["Plano de cera", "plano_cera"],
  ["Plano de cera — Cera", "plano_cera"],
  ["Montagem — Cera", "montagem"],
  ["Acabamento — Cera", "acabamento"],
  ["Acrilização — Cera", "acrilizacao"],
  ["Entrada — Cera", "entrada"],
  ["Prova em cera", "acabamento"],
  ["Montagem", "montagem"],
  ["Modelo", "plano_cera"],
  ["Pronto / Entrega", "pronto_entrega"],
];

let falhas = 0;
for (const [nome, esperado] of casos) {
  const obtido = mapearNomeEtapaParaColuna(nome);
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(
    ok ? "OK  " : "FAIL",
    JSON.stringify(nome),
    "->",
    obtido,
    ok ? "" : `(esperado ${esperado})`
  );
}

if (falhas) {
  console.error("Falhas:", falhas);
  process.exit(1);
}
console.log("Todos os mapeamentos OK");
