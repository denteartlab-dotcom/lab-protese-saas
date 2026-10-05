/**
 * Contas vencidas em aberto devem aparecer em qualquer período do filtro.
 * Uso: npx tsx scripts/testar-faturas-vencidas-periodo.ts
 */
import {
  faturasExibicaoPainelCliente,
  lancamentoVencidoEmAberto,
  passaFiltroPeriodoOuVencido,
  type LancamentoContasReceber,
} from "../src/lib/contas-receber-financeiro";
import { calcularResumoFinanceiroDashboard } from "../src/lib/dashboard-financeiro";

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
const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
fimMes.setHours(23, 59, 59, 999);
const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 10);
const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 15);

const vencida: LancamentoContasReceber = {
  id: "fat-vencida",
  tipo: "receita",
  descricao: "Cobrança OS 80 @@trab:os80@@",
  valor: 1200,
  data: isoLocal(mesAnterior),
  status: "pendente",
  cliente: { id: "cli-1", nome: "Ana" },
};
const doMes: LancamentoContasReceber = {
  id: "fat-mes",
  tipo: "receita",
  descricao: "Cobrança OS 81 @@trab:os81@@",
  valor: 400,
  data: isoLocal(hoje),
  status: "pendente",
  cliente: { id: "cli-1", nome: "Ana" },
};
const futura: LancamentoContasReceber = {
  id: "fat-futura",
  tipo: "receita",
  descricao: "Cobrança OS 82 @@trab:os82@@",
  valor: 900,
  data: isoLocal(proximoMes),
  status: "pendente",
  cliente: { id: "cli-1", nome: "Ana" },
};
const pagaAntiga: LancamentoContasReceber = {
  id: "fat-paga",
  tipo: "receita",
  descricao: "Cobrança OS 83 @@trab:os83@@",
  valor: 300,
  data: isoLocal(mesAnterior),
  status: "pago",
  cliente: { id: "cli-1", nome: "Ana" },
};

const todos = [vencida, doMes, futura, pagaAntiga];

assert(lancamentoVencidoEmAberto(vencida), "nota do mês anterior em aberto está vencida");
assert(!lancamentoVencidoEmAberto(doMes), "nota de hoje ainda não está vencida");
assert(!lancamentoVencidoEmAberto(futura), "nota futura não está vencida");
assert(!lancamentoVencidoEmAberto(pagaAntiga), "nota paga não entra como vencida");

assert(
  passaFiltroPeriodoOuVencido(vencida, inicioMes, fimMes),
  "vencida de outro mês passa no filtro do mês vigente"
);
assert(
  passaFiltroPeriodoOuVencido(doMes, inicioMes, fimMes),
  "nota do mês vigente permanece no filtro"
);
assert(
  !passaFiltroPeriodoOuVencido(futura, inicioMes, fimMes),
  "nota a vencer no próximo mês não entra no mês vigente"
);
assert(
  !passaFiltroPeriodoOuVencido(pagaAntiga, inicioMes, fimMes),
  "nota paga de outro mês não entra só por ser antiga"
);

const noMes = faturasExibicaoPainelCliente("cli-1", todos, {
  inicio: inicioMes,
  fim: fimMes,
});
const ids = noMes.map((f) => f.id).sort();
assert(ids.includes("fat-vencida"), `vencida deve aparecer no mês vigente: ${ids.join(",")}`);
assert(ids.includes("fat-mes"), `nota do mês deve aparecer: ${ids.join(",")}`);
assert(!ids.includes("fat-futura"), `futura não deve aparecer: ${ids.join(",")}`);

const soAtraso = faturasExibicaoPainelCliente("cli-1", todos, {
  inicio: inicioMes,
  fim: fimMes,
  situacao: "atraso",
});
assert(
  soAtraso.some((f) => f.id === "fat-vencida"),
  "filtro Em atraso ainda mostra vencida fora do período"
);
assert(
  !soAtraso.some((f) => f.id === "fat-mes"),
  "nota em dia não entra em Em atraso"
);

const dashboard = calcularResumoFinanceiroDashboard(
  [
    {
      id: vencida.id,
      tipo: "receita",
      descricao: vencida.descricao,
      valor: vencida.valor,
      data: vencida.data,
      status: vencida.status,
      clienteId: "cli-1",
      clienteNome: "Ana",
    },
    {
      id: doMes.id,
      tipo: "receita",
      descricao: doMes.descricao,
      valor: doMes.valor,
      data: doMes.data,
      status: doMes.status,
      clienteId: "cli-1",
      clienteNome: "Ana",
    },
    {
      id: futura.id,
      tipo: "receita",
      descricao: futura.descricao,
      valor: futura.valor,
      data: futura.data,
      status: futura.status,
      clienteId: "cli-1",
      clienteNome: "Ana",
    },
    {
      id: "d-vencida",
      tipo: "despesa",
      descricao: "Conta vencida de outro mês",
      valor: 250,
      data: isoLocal(mesAnterior),
      status: "pendente",
    },
    {
      id: "d-futura",
      tipo: "despesa",
      descricao: "Conta do próximo mês",
      valor: 777,
      data: isoLocal(proximoMes),
      status: "pendente",
    },
  ],
  [],
  { mes: hoje.getMonth(), ano: hoje.getFullYear() }
);

assert(
  Math.abs(dashboard.receitasAReceber - (1200 + 400)) < 0.01,
  `Início deve somar a vencida de outro mês: ${dashboard.receitasAReceber}`
);
assert(
  Math.abs(dashboard.receitasInadimplencia - 1200) < 0.01,
  `inadimplência da vencida: ${dashboard.receitasInadimplencia}`
);
assert(
  Math.abs(dashboard.despesasAPagar - 250) < 0.01,
  `despesa vencida de outro mês aparece no Início: ${dashboard.despesasAPagar}`
);
assert(
  Math.abs(dashboard.despesasVencidas - 250) < 0.01,
  `despesa futura não entra nas vencidas: ${dashboard.despesasVencidas}`
);

console.log("ok: contas vencidas aparecem em qualquer período");
