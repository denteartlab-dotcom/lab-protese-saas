/**
 * Valida regras de despesa fixa (mês vigente, sem futuro, sem duplicata).
 * Uso: node node_modules/tsx/dist/cli.mjs scripts/testar-despesa-fixa.ts
 */
import {
  empacotarDespesa,
  descricaoDespesaComParcela,
} from "../src/lib/lancamento-despesa";
import {
  instanciaFixaEhFutura,
  idsInstanciasFixasIndevidas,
  idsInstanciasFixasDuplicadas,
  podeGerarInstanciaFixaMesCorrente,
  vencimentoParcelaNoMes,
  mesReferenciaAtual,
  metaDespesaFixa,
  ehCategoriaSalariosFixos,
  quintoDiaUtilDoMes,
  diaQuintoDiaUtilDoMes,
  parcelasInstanciaFixaNoMes,
} from "../src/lib/despesa-fixa";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FALHOU:", msg);
    process.exit(1);
  }
}

const grupo = "fixa-teste-grupo";
const mesAtual = mesReferenciaAtual();

function item(id: string, mesRef: string, vencimentoIso: string) {
  const meta = metaDespesaFixa(
    { nome: "Teste", categoria: "Salários Fixos", conta: "Caixa Principal" },
    grupo,
    mesRef,
    7
  );
  const base = empacotarDespesa("Andre Ribas", meta);
  return {
    id,
    descricao: descricaoDespesaComParcela(base, "1/1"),
    valor: 700,
    data: `${vencimentoIso}T12:00:00.000Z`,
    status: "pendente",
  };
}

const julho = item("jul", mesAtual, `${mesAtual}-07`);
const [ano, mesNum] = mesAtual.split("-");
const proxMes =
  mesNum === "12"
    ? `${Number(ano) + 1}-01`
    : `${ano}-${String(Number(mesNum) + 1).padStart(2, "0")}`;
const agosto = item("ago", proxMes, `${proxMes}-07`);

assert(!instanciaFixaEhFutura(julho, mesAtual), "Julho vigente não é futuro");
assert(instanciaFixaEhFutura(agosto, mesAtual), "Agosto é futuro no mês vigente");

const duplicata = item("jul-dup", mesAtual, `${mesAtual}-07`);
const duplicados = idsInstanciasFixasDuplicadas([julho, duplicata]);
assert(
  duplicados.length === 1 && duplicados[0] === "jul-dup",
  "Detecta duplicata no mesmo mês"
);

const indevidos = idsInstanciasFixasIndevidas([julho, agosto, duplicata]);
assert(
  indevidos.includes("ago") && indevidos.includes("jul-dup"),
  "Remove futuro + duplicata"
);

assert(
  !podeGerarInstanciaFixaMesCorrente(mesAtual, [julho], grupo),
  "Não gera se já existe instância do mês"
);
assert(
  !podeGerarInstanciaFixaMesCorrente(mesAtual, [], grupo),
  "Não gera sem histórico do grupo"
);
assert(
  !podeGerarInstanciaFixaMesCorrente(proxMes, [julho], grupo),
  "Não gera mês futuro"
);

const mesAnterior =
  mesNum === "01"
    ? `${Number(ano) - 1}-12`
    : `${ano}-${String(Number(mesNum) - 1).padStart(2, "0")}`;
const julhoAtrasado = item("jul-atraso", mesAnterior, `${mesAnterior}-07`);
assert(
  !instanciaFixaEhFutura(julhoAtrasado, mesAtual),
  "Parcela vencida do mês anterior permanece após virada de mês"
);

const julhoComVencAgosto = item("jul-ago", mesAtual, `${proxMes}-07`);
assert(
  instanciaFixaEhFutura(julhoComVencAgosto, mesAtual),
  "Remove legado com vencimento no mês futuro mesmo se fixaMes for vigente"
);
assert(
  !idsInstanciasFixasIndevidas([julhoAtrasado, julho]).includes("jul-atraso"),
  "Não remove atraso do mês anterior ao gerar mês vigente"
);

const venc = vencimentoParcelaNoMes(mesAtual, 7, 0);
assert(venc.includes("/07/"), "Vencimento parcela 0 no dia 7");

assert(ehCategoriaSalariosFixos("Salários Fixos"), "Detecta Salários Fixos");
assert(ehCategoriaSalariosFixos("Salarios Fixos"), "Detecta sem acento");
assert(!ehCategoriaSalariosFixos("Aluguel"), "Não marca aluguel como salário");

const quinto = quintoDiaUtilDoMes(mesAtual);
assert(quinto.getDay() !== 0 && quinto.getDay() !== 6, "5º dia útil não é fim de semana");
const vencSalario = vencimentoParcelaNoMes(mesAtual, 1, 1, {
  categoria: "Salários Fixos",
});
const diaEsperado = String(diaQuintoDiaUtilDoMes(mesAtual)).padStart(2, "0");
assert(
  vencSalario.startsWith(`${diaEsperado}/`),
  `Salário fixo vence no 5º dia útil (${vencSalario} vs dia ${diaEsperado})`
);
assert(
  vencimentoParcelaNoMes(mesAtual, 1, 0, { categoria: "Salários Fixos" }) ===
    vencimentoParcelaNoMes(mesAtual, 31, 2, { categoria: "Salários Fixos" }),
  "Salário ignora dia preferido e índice de parcela"
);

const templateSalario = {
  grupoId: grupo,
  textoBase: "Andre Ribas",
  metaBase: { categoria: "Salários Fixos", conta: "Caixa Principal" },
  diaVencimento: 1,
  parcelas: [
    {
      parcela: "1/1",
      valor: 700,
      vencimento: "01/01/2020",
      status: "pendente" as const,
      formaPagamento: "Pix",
      conta: "Caixa Principal",
    },
  ],
};
const parcelasSalario = parcelasInstanciaFixaNoMes(templateSalario, mesAtual);
assert(
  parcelasSalario[0]?.vencimento === vencSalario,
  "parcelasInstanciaFixaNoMes aplica 5º dia útil para salário"
);

console.log("OK — regras de despesa fixa validadas para mesAtual =", mesAtual);
