/**
 * Testes unitários das diárias de colaboradores (horas, valor e jornada).
 */
import assert from "node:assert/strict";
import {
  atualizarConfigERecalcular,
  celulasCalendarioMes,
  criarLancamentoDiaria,
  diaDeveTrabalhar,
  formatarDataIsoBr,
  formatarHorasDecimais,
  horasJornadaDaCarga,
  horasTrabalhadas,
  idDiaSemanaDeData,
  lancamentosDoMes,
  limparLancamentosMes,
  minutosLiquidosTurno,
  nomeMesAnoDiarias,
  preencherMesComJornada,
  resumoDiariasMes,
  resumoGeralDiariasMes,
  referenciaDespesaDiariaColaborador,
  descricaoDespesaDiariaColaborador,
  ehReferenciaDespesaDiariaColaborador,
  sugerirValorDiaria,
  totaisDiariasPorCompetencia,
  valorDiariaDeOrigem,
  valorDiariaProporcional,
  aplicarCadastroNaConfigDiaria,
  garantirConfigColaborador,
  horasLancamentoDiaria,
  horarioPadraoDoDia,
  aplicarValorManualLancamento,
  recalcularLancamento,
  type ConfigDiariaColaborador,
  type DiariasStore,
} from "../src/lib/diarias-colaboradores";
import {
  montarTextoExemploRemuneracao,
  normalizarTipoContratacaoCadastro,
  usaComissaoColaborador,
  usaDiariaColaborador,
  usaSalarioColaborador,
} from "../src/lib/colaborador-remuneracao";
import { clonarHorarioFuncionamento } from "../src/lib/horario-funcionamento";
import { filtroAgendaDaUrl, semanaOffsetParaData } from "../src/lib/agenda-producao";
import { nomeArquivoNotaDiarias } from "../src/lib/pdf-nota-pagamento-diarias";
import { lancamentoEhDespesaDiariaColaborador } from "../src/lib/despesa-diaria-colaborador";
import { empacotarDespesa } from "../src/lib/lancamento-despesa";

function ok(nome: string) {
  console.log(`ok  ${nome}`);
}

assert.equal(minutosLiquidosTurno("08:00", "18:00", 60), 540);
assert.equal(horasTrabalhadas("08:00", "18:00", 60), 9);
ok("jornada 08-18 com 1h de intervalo");

assert.equal(
  horasLancamentoDiaria({
    entrada: "08:00",
    saidaManha: "12:00",
    entradaTarde: "13:00",
    saida: "18:00",
  }),
  10
);
ok("dois turnos pagam das 08:00 às 18:00 sem descontar o intervalo");

assert.equal(horasTrabalhadas("22:00", "06:00", 0), 8);
ok("turno que atravessa a meia-noite");

assert.equal(valorDiariaProporcional(8, 8, 160), 160);
assert.equal(valorDiariaProporcional(4, 8, 160), 80);
assert.equal(valorDiariaProporcional(10, 8, 160), 200);
ok("valor proporcional à jornada, inclusive hora extra");

assert.equal(formatarHorasDecimais(9), "9h00");
assert.equal(formatarHorasDecimais(8.5), "8h30");
ok("formato de horas");

assert.equal(sugerirValorDiaria("2.200,00", 22), "100,00");
ok("sugestão da diária pelo salário");

assert.equal(idDiaSemanaDeData("2026-10-07"), "quarta");
assert.equal(idDiaSemanaDeData("2026-10-10"), "sabado");
ok("dia da semana a partir da data");

const carga = clonarHorarioFuncionamento(null);
assert.equal(horasJornadaDaCarga(carga), 10);
assert.equal(diaDeveTrabalhar(carga, "2026-10-07"), true);
assert.equal(diaDeveTrabalhar(carga, "2026-10-10"), false);
ok("jornada padrão marca só dias úteis");

const config: ConfigDiariaColaborador = {
  colaboradorId: "c1",
  colaboradorNome: "Ana",
  valorDiaria: "160,00",
  horasJornada: 8,
};

let store: DiariasStore = { configs: { c1: config }, lancamentos: [], despesas: {} };
store = preencherMesComJornada(store, "c1", 2026, 10, carga);
const outubro = resumoDiariasMes(store, "c1", 2026, 10);
assert.equal(outubro.dias, 22);
assert.ok(outubro.valor > 0);
ok("preenche outubro 2026 com a jornada (22 dias úteis)");

const segundo = preencherMesComJornada(store, "c1", 2026, 10, carga);
assert.equal(segundo.lancamentos.length, store.lancamentos.length);
ok("não duplica dias já lançados");

const parcial = criarLancamentoDiaria("c1", "2026-10-07", config, {
  entrada: "08:00",
  saidaManha: "12:00",
  entradaTarde: "",
  saida: "",
});
assert.equal(parcial.horas, 4);
assert.equal(parcial.valor, 80);
ok("meio período vale metade da diária");

const diaCompleto = criarLancamentoDiaria("c1", "2026-10-08", config, {
  entrada: "08:00",
  saidaManha: "12:00",
  entradaTarde: "13:00",
  saida: "18:00",
});
assert.equal(diaCompleto.horas, 10);
assert.equal(diaCompleto.valor, 200);
ok("diária completa não desconta o almoço");

const valorEditado = aplicarValorManualLancamento(diaCompleto, 175.5);
assert.equal(valorEditado.valor, 175.5);
assert.equal(valorEditado.valorManual, true);
const depoisHorario = recalcularLancamento(
  { ...valorEditado, saida: "16:00" },
  config
);
assert.equal(depoisHorario.valor, 175.5);
assert.ok(depoisHorario.horas < diaCompleto.horas);
ok("valor editado no R$ permanece ao recalcular o horário");

const padraoCarga = horarioPadraoDoDia(carga, "2026-10-07");
assert.equal(padraoCarga.entrada, "08:00");
assert.equal(padraoCarga.saidaManha, "12:00");
assert.equal(padraoCarga.entradaTarde, "13:00");
assert.equal(padraoCarga.saida, "18:00");
ok("jornada padrão divide manhã e tarde");

store = atualizarConfigERecalcular(store, { ...config, valorDiaria: "200,00" });
const depois = resumoDiariasMes(store, "c1", 2026, 10);
assert.ok(depois.valor > outubro.valor);
ok("recalcula o mês ao mudar o valor da diária");

assert.equal(lancamentosDoMes(store, "c1", 2026, 10).length, 22);
const geral = resumoGeralDiariasMes(store, 2026, 10);
assert.equal(geral.colaboradores, 1);
assert.equal(geral.dias, 22);
assert.ok(geral.valor > 0);
ok("resumo geral do mês só conta quem trabalhou");

assert.equal(formatarDataIsoBr("2026-10-07"), "07/10/2026");
assert.equal(nomeMesAnoDiarias(2026, 10, "pt").toLowerCase().includes("outubro"), true);
assert.equal(
  nomeArquivoNotaDiarias([
    {
      colaboradorId: "c1",
      colaboradorNome: "Ana Souza",
      valorDiaria: "160,00",
      horasJornada: 8,
      dias: 22,
      horas: 176,
      valor: 3520,
      lancamentos: [],
      ano: 2026,
      mes: 10,
    },
  ]),
  "nota-diarias-ana-souza-2026-10.pdf"
);
ok("nome do arquivo da nota de pagamento");

assert.equal(referenciaDespesaDiariaColaborador("João Silva", "2026-10"), "diaria-colab:joao-silva:2026-10");
assert.equal(ehReferenciaDespesaDiariaColaborador("diaria-colab:joao-silva:2026-10"), true);
assert.equal(ehReferenciaDespesaDiariaColaborador("comissao-colab:joao-silva:2026-10"), false);
assert.equal(
  descricaoDespesaDiariaColaborador("João Silva", "2026-10"),
  "Diária João Silva — Outubro de 2026"
);
const totais = totaisDiariasPorCompetencia(store);
assert.equal(totais.length, 1);
assert.equal(totais[0].colaboradorNome, "Ana");
assert.equal(totais[0].mesCompetencia, "2026-10");
assert.ok(totais[0].valor > 0);
const descricaoPack = empacotarDespesa("Diária João Silva — Outubro de 2026", {
  entidade: "colaboradores",
  categoria: "Comissões, Bônus ou Prêmios",
  conta: "Caixa Principal",
  parcela: "1",
  referencia: "diaria-colab:joao-silva:2026-10",
  nome: "João Silva",
  fixaDiaVencimento: 10,
});
assert.equal(
  lancamentoEhDespesaDiariaColaborador(
    { id: "d1", tipo: "despesa", descricao: descricaoPack },
    "João Silva",
    "2026-10"
  ),
  true
);
assert.equal(
  lancamentoEhDespesaDiariaColaborador(
    { id: "d1", tipo: "despesa", descricao: descricaoPack },
    "Maria",
    "2026-10"
  ),
  false
);
ok("despesa de diária usa o mesmo formato da comissão");

store = limparLancamentosMes(store, "c1", 2026, 10);
assert.equal(resumoDiariasMes(store, "c1", 2026, 10).dias, 0);
ok("limpa só o mês selecionado");

const celulas = celulasCalendarioMes(2026, 10);
assert.equal(celulas[0], null);
assert.equal(celulas[3], "2026-10-01");
ok("calendário de outubro 2026 começa na quinta");

const ref = new Date(2026, 9, 7);
assert.equal(semanaOffsetParaData("2026-10-07", ref), 0);
assert.equal(semanaOffsetParaData("2026-10-12", ref), 1);
assert.equal(semanaOffsetParaData("2026-09-28", ref), -1);
ok("offset da semana da agenda");

const url = filtroAgendaDaUrl(new URLSearchParams("dia=2026-10-07"));
assert.equal(url.filtro, "data-2026-10-07");
ok("filtro da agenda a partir da URL");

assert.equal(carga.dias.length, 7);

assert.equal(normalizarTipoContratacaoCadastro("Diária"), "Diária");
assert.equal(normalizarTipoContratacaoCadastro("Daily rate"), "Diária");
assert.equal(normalizarTipoContratacaoCadastro("Diaria + comisión"), "Diária + Comissão");
assert.equal(usaDiariaColaborador("Diária"), true);
assert.equal(usaDiariaColaborador("Diária + Comissão"), true);
assert.equal(usaSalarioColaborador("Diária"), false);
assert.equal(usaComissaoColaborador("Diária"), false);
assert.equal(usaComissaoColaborador("Diária + Comissão"), true);
assert.equal(usaComissaoColaborador("Salary + commission"), true);
ok("tipos de remuneração com diária");

assert.equal(valorDiariaDeOrigem({ valorDiaria: "150,00", valorSalario: "2.200,00" }), "150,00");
assert.equal(valorDiariaDeOrigem({ valorDiaria: "0,00", valorSalario: "2.200,00" }, "80,00"), "80,00");
assert.equal(valorDiariaDeOrigem({ valorDiaria: "0,00", valorSalario: "2.200,00" }), "100,00");
ok("valor da diária prefere o cadastro, depois o atual, depois o salário");

let storeCadastro: DiariasStore = { configs: {}, lancamentos: [], despesas: {} };
storeCadastro = aplicarCadastroNaConfigDiaria(storeCadastro, {
  id: "mateus",
  nome: "Mateus Bonfim",
  valorDiaria: "180,00",
  valorSalario: "3.000,00",
  cargaHoraria: carga,
});
assert.equal(storeCadastro.configs.mateus.valorDiaria, "180,00");
assert.equal(storeCadastro.configs.mateus.colaboradorNome, "Mateus Bonfim");
ok("cadastro de diária cria a config no módulo de diárias");

storeCadastro = aplicarCadastroNaConfigDiaria(storeCadastro, {
  id: "mateus",
  nome: "Mateus Bonfim",
  valorDiaria: "200,00",
  valorSalario: "3.000,00",
  cargaHoraria: carga,
});
assert.equal(storeCadastro.configs.mateus.valorDiaria, "200,00");
ok("alterar o valor no cadastro atualiza a config de diárias");

storeCadastro = garantirConfigColaborador(storeCadastro, {
  id: "mateus",
  nome: "Mateus Bonfim",
  valorSalario: "3.000,00",
  valorDiaria: "200,00",
  tipoContratacao: "Diária",
  cargaHoraria: carga,
});
assert.equal(storeCadastro.configs.mateus.valorDiaria, "200,00");
ok("abrir diárias mantém o valor cadastrado");

const exemploDiaria = montarTextoExemploRemuneracao({
  tipoContratacao: "Diária",
  valorSalario: "0,00",
  valorDiaria: "180,00",
  valorComissao: "0,00",
  tipoValorComissao: "%",
  comissaoRepeticao: "0,00",
  tipoValorComissaoRepeticao: "%",
});
assert.equal(exemploDiaria.includes("180"), true);
ok("texto de exemplo da remuneração por diária");

console.log("todos os testes de diárias passaram");
