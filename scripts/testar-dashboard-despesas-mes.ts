/**
 * Despesas do Início devem acompanhar o vencimento do mês selecionado,
 * iguais ao filtro padrão de Contas a pagar.
 * Uso: npx tsx scripts/testar-dashboard-despesas-mes.ts
 */
import {
  calcularResumoFinanceiroDashboard,
  vencimentoNoMesAno,
  type LancamentoFinanceiroResumo,
} from "../src/lib/dashboard-financeiro";

function assert(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(mensagem);
}

function isoLocal(data: Date) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);
const mes = hoje.getMonth();
const ano = hoje.getFullYear();
const inicioMes = new Date(ano, mes, 1);
const mesAnterior = new Date(ano, mes - 1, 15);

const lancamentos: LancamentoFinanceiroResumo[] = [
  {
    id: "d-hoje",
    tipo: "despesa",
    descricao: "Despesa do mês ainda no prazo",
    valor: 1500,
    data: isoLocal(hoje),
    status: "pendente",
  },
  {
    id: "d-antiga",
    tipo: "despesa",
    descricao: "Despesa de outro mês ainda pendente",
    valor: 94264,
    data: isoLocal(mesAnterior),
    status: "pendente",
  },
  {
    id: "d-paga",
    tipo: "despesa",
    descricao: "Já paga no mês",
    valor: 800,
    data: isoLocal(hoje),
    status: "pago",
  },
  {
    id: "d-cancelada",
    tipo: "despesa",
    descricao: "Cancelada",
    valor: 50,
    data: isoLocal(hoje),
    status: "cancelado",
  },
];

if (inicioMes < hoje) {
  lancamentos.push({
    id: "d-mes-vencida",
    tipo: "despesa",
    descricao: "Vencida no mês vigente",
    valor: 200,
    data: isoLocal(inicioMes),
    status: "pendente",
  });
}

assert(vencimentoNoMesAno(isoLocal(hoje), mes, ano), "hoje pertence ao mês vigente");
assert(
  !vencimentoNoMesAno(isoLocal(mesAnterior), mes, ano),
  "despesa do mês anterior fica de fora"
);

const semFiltro = calcularResumoFinanceiroDashboard(lancamentos, []);
const esperadoHistorico = 1500 + 94264 + (inicioMes < hoje ? 200 : 0);
assert(
  Math.abs(semFiltro.despesasAPagar - esperadoHistorico) < 0.01,
  `sem mês ainda soma o histórico: ${semFiltro.despesasAPagar}`
);

const doMes = calcularResumoFinanceiroDashboard(lancamentos, [], { mes, ano });
const esperadoMes = 1500 + (inicioMes < hoje ? 200 : 0);
assert(
  Math.abs(doMes.despesasAPagar - esperadoMes) < 0.01,
  `mês vigente não pode incluir 94.264: ${doMes.despesasAPagar}`
);
assert(
  doMes.despesasVencidas <= doMes.despesasAPagar,
  "contas vencidas são recorte de a pagar do mês"
);
if (inicioMes < hoje) {
  assert(
    Math.abs(doMes.despesasVencidas - 200) < 0.01,
    `só a vencida do mês entra: ${doMes.despesasVencidas}`
  );
}

console.log("ok: despesas do Início acompanham o mês vigente");
