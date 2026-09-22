import {
  calcularDebitoAbertoOutrasFaturas,
  formatarSaldoAnteriorDebitoFatura,
  formatarSaldoAnteriorCreditoFatura,
  listarFaturasDebitoAberto,
} from "../src/lib/fatura-cliente-financeiro";
import {
  descricaoSaldoAnteriorIncorporado,
  empacotarSaldoDevedorIncorporado,
  extrairSaldoDevedorIncorporado,
  faturaTemNotaImprimivel,
  incorporacoesSaldoDaFatura,
  isSaldoAnteriorIncorporado,
  recebidoNaFatura,
  saldoFatura,
  type LancamentoContasReceber,
} from "../src/lib/contas-receber-financeiro";

function money(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function assert(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(mensagem);
}

const debitoFmt = formatarSaldoAnteriorDebitoFatura(2014.3, money);
assert(debitoFmt.startsWith("-"), `débito deve ter sinal negativo: ${debitoFmt}`);
assert(debitoFmt.includes("D"), `débito deve manter sufixo D: ${debitoFmt}`);

const creditoFmt = formatarSaldoAnteriorCreditoFatura(350, money);
assert(creditoFmt.startsWith("-"), `crédito continua com sinal negativo: ${creditoFmt}`);
assert(creditoFmt.includes("C"), `crédito deve manter sufixo C: ${creditoFmt}`);

const empacotado = empacotarSaldoDevedorIncorporado("Cobrança OS 10 @@trab:abc@@", 2014.3, [
  "fat-antiga-1",
  "fat-antiga-2",
]);
const extraido = extrairSaldoDevedorIncorporado(empacotado);
assert(Math.abs(extraido.valor - 2014.3) < 0.001, `valor extraído ${extraido.valor}`);
assert(extraido.ids.join(",") === "fat-antiga-1,fat-antiga-2", `ids ${extraido.ids.join(",")}`);

const antiga: LancamentoContasReceber = {
  id: "fat-antiga-1",
  tipo: "receita",
  descricao: "Cobrança OS 46 @@trab:os46@@",
  valor: 2500,
  data: "2026-08-10",
  status: "pendente",
  cliente: { id: "cli-1", nome: "João" },
};
const parcial: LancamentoContasReceber = {
  id: "parcial-1",
  tipo: "receita",
  descricao: "Recebimento parcial - Cobrança OS 46 @@trab:os46@@",
  valor: 485.7,
  data: "2026-08-15",
  status: "pago",
  cliente: { id: "cli-1", nome: "João" },
};
const nova: LancamentoContasReceber = {
  id: "fat-nova",
  tipo: "receita",
  descricao: empacotarSaldoDevedorIncorporado("Cobrança OS 5 @@trab:os5@@", 2014.3, ["fat-antiga-1"]),
  valor: 3464.3,
  data: "2026-09-22",
  status: "pendente",
  cliente: { id: "cli-1", nome: "João" },
};
const incorporacao: LancamentoContasReceber = {
  id: "inc-1",
  tipo: "receita",
  descricao: descricaoSaldoAnteriorIncorporado(antiga.descricao),
  valor: 2014.3,
  data: "2026-09-22",
  status: "pago",
  formaPagamento: "Saldo anterior incorporado",
  cliente: { id: "cli-1", nome: "João" },
};

assert(isSaldoAnteriorIncorporado(incorporacao), "deve reconhecer lançamento de incorporação");
assert(!isSaldoAnteriorIncorporado(nova), "nova fatura não é lançamento de incorporação");

const todos = [antiga, parcial, nova, incorporacao];
assert(
  incorporacoesSaldoDaFatura(antiga, todos).length === 1,
  "deve localizar incorporação da fatura antiga"
);
assert(!faturaTemNotaImprimivel(antiga, todos), "fatura incorporada não imprime nota");
assert(faturaTemNotaImprimivel(nova, todos), "nova fatura continua imprimível");

const recebidoAntiga = recebidoNaFatura(antiga, todos);
assert(Math.abs(recebidoAntiga - 2500) < 0.02, `recebido antiga ${recebidoAntiga}`);
assert(saldoFatura(antiga, todos) <= 0.009, `saldo antiga deve zerar: ${saldoFatura(antiga, todos)}`);

const abertasAntes = listarFaturasDebitoAberto([antiga, parcial], "cli-1");
assert(abertasAntes.length === 1, "antes da incorporação há 1 fatura em aberto");
assert(
  Math.abs(calcularDebitoAbertoOutrasFaturas([antiga, parcial], "cli-1") - 2014.3) < 0.02,
  "débito aberto antes da incorporação"
);

const abertasDepois = listarFaturasDebitoAberto(todos, "cli-1", "fat-nova");
assert(abertasDepois.length === 0, "depois da incorporação o débito antigo some do saldo aberto");

console.log("ok saldo-devedor-fatura");
