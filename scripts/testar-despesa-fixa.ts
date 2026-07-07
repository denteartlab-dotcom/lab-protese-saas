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
  podeGerarInstanciaFixaMesCorrente(mesAtual, [julho], grupo),
  "Pode gerar se ainda não existe instância do mês"
);
assert(
  !podeGerarInstanciaFixaMesCorrente(proxMes, [julho], grupo),
  "Não gera mês futuro"
);

const venc = vencimentoParcelaNoMes(mesAtual, 7, 0);
assert(venc.includes("/07/"), "Vencimento parcela 0 no dia 7");

console.log("OK — regras de despesa fixa validadas para mesAtual =", mesAtual);
