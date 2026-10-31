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
  colaboradorPodeLancarDiaria,
  horasLancamentoDiaria,
  horasTrabalhadasLancamento,
  horarioLancamentoPadrao,
  horarioPadraoDoDia,
  horarioPorDuracao,
  formatarHoraDigitada,
  descricaoCobrancaDiariaColaborador,
  dataFimMesCompetencia,
  normalizarConfigDiaria,
  limitarHoraNoPeriodo,
  PERIODO_MANHA_FIM,
  PERIODO_MANHA_INICIO,
  PERIODO_TARDE_FIM,
  PERIODO_TARDE_INICIO,
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

assert.equal(formatarHoraDigitada("8"), "08:");
assert.equal(formatarHoraDigitada("9"), "09:");
assert.equal(formatarHoraDigitada("90"), "09:0");
assert.equal(formatarHoraDigitada("900"), "09:00");
assert.equal(formatarHoraDigitada("9000"), "09:00");
assert.equal(formatarHoraDigitada("09"), "09:");
assert.equal(formatarHoraDigitada("0900"), "09:00");
assert.equal(formatarHoraDigitada("3", "08:"), "03:");
assert.equal(formatarHoraDigitada("13"), "13:");
assert.equal(formatarHoraDigitada("13:0", "13:"), "13:0");
assert.equal(formatarHoraDigitada("1300"), "13:00");
assert.equal(formatarHoraDigitada("0800"), "08:00");
assert.equal(formatarHoraDigitada("8:30"), "08:30");
assert.equal(formatarHoraDigitada("13:", "13:0"), "13:");
assert.equal(formatarHoraDigitada("13", "13:"), "1");
assert.equal(formatarHoraDigitada("1360"), "13:59");
assert.equal(formatarHoraDigitada(""), "");
ok("horário digitado completa sozinho no formato 00:00");

assert.equal(dataFimMesCompetencia("2026-10"), "2026-10-31");
assert.equal(dataFimMesCompetencia("2024-02"), "2024-02-29");
assert.equal(
  descricaoCobrancaDiariaColaborador("Mateus Bonfim", "2026-10").startsWith("Cobrança sem O.S."),
  true
);
ok("cobrança da diária cai no mês vigente e entra em contas a receber");

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

assert.equal(
  horasLancamentoDiaria({
    entrada: "08:00",
    saidaManha: "12:00",
    entradaTarde: "13:00",
    saida: "18:00",
    turnoManha: true,
    turnoTarde: false,
  }),
  4
);
assert.equal(
  horasLancamentoDiaria({
    entrada: "06:00",
    saidaManha: "12:00",
    entradaTarde: "13:00",
    saida: "18:00",
    turnoManha: false,
    turnoTarde: true,
  }),
  5
);
assert.equal(
  horasLancamentoDiaria({
    entrada: "06:00",
    saidaManha: "12:00",
    entradaTarde: "13:00",
    saida: "18:00",
    turnoManha: false,
    turnoTarde: false,
  }),
  0
);
ok("toggle de turno conta só o período ligado");

assert.equal(limitarHoraNoPeriodo("05:30", PERIODO_MANHA_INICIO, PERIODO_MANHA_FIM), "06:00");
assert.equal(limitarHoraNoPeriodo("08:15", PERIODO_MANHA_INICIO, PERIODO_MANHA_FIM), "08:15");
assert.equal(limitarHoraNoPeriodo("14:00", PERIODO_MANHA_INICIO, PERIODO_MANHA_FIM), "12:00");
assert.equal(limitarHoraNoPeriodo("12:30", PERIODO_TARDE_INICIO, PERIODO_TARDE_FIM), "13:00");
assert.equal(limitarHoraNoPeriodo("19:10", PERIODO_TARDE_INICIO, PERIODO_TARDE_FIM), "18:00");
ok("horário da manhã fica entre 06:00 e 12:00 e o da tarde entre 13:00 e 18:00");

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
ok("manhã sozinha vale metade da diária, sem cálculo por hora");

const tarde = criarLancamentoDiaria("c1", "2026-10-07", { ...config, valorDiaria: "200,00" }, {
  entrada: "",
  saidaManha: "",
  entradaTarde: "13:00",
  saida: "18:00",
});
assert.equal(tarde.valor, 100);
const manhaCurta = criarLancamentoDiaria("c1", "2026-10-07", { ...config, valorDiaria: "200,00" }, {
  entrada: "08:00",
  saidaManha: "10:00",
  entradaTarde: "",
  saida: "",
});
assert.equal(manhaCurta.horas, 2);
assert.equal(manhaCurta.valor, 100);
ok("tarde sozinha e manhã mais curta também valem metade");

const diaCompleto = criarLancamentoDiaria("c1", "2026-10-08", config, {
  entrada: "08:00",
  saidaManha: "12:00",
  entradaTarde: "13:00",
  saida: "18:00",
});
assert.equal(diaCompleto.horas, 10);
assert.equal(diaCompleto.valor, 160);
const diaCompleto200 = recalcularLancamento(diaCompleto, { ...config, valorDiaria: "200,00" });
assert.equal(diaCompleto200.valor, 200);
ok("os dois turnos valem a diária inteira, mesmo com mais de 8 horas");

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

assert.deepEqual(horarioPorDuracao("08:00", 4, 4, 1), {
  entrada: "08:00",
  saidaManha: "12:00",
  entradaTarde: "13:00",
  saida: "17:00",
});
ok("4h + intervalo de 1h + 4h monta 08:00–12:00 e 13:00–17:00");

assert.deepEqual(horarioPorDuracao("08:00", 3, 4, 2), {
  entrada: "08:00",
  saidaManha: "11:00",
  entradaTarde: "13:00",
  saida: "17:00",
});
ok("3h de manhã, 2h de intervalo e 4h de tarde");

const configDuracao = normalizarConfigDiaria({
  colaboradorId: "c1",
  colaboradorNome: "Ana",
  valorDiaria: "200,00",
  horasJornada: 8,
  horasTurnoManha: 3,
  horasTurnoTarde: 4,
  intervaloHoras: 2,
});
assert.deepEqual(horarioLancamentoPadrao(configDuracao, null, "2026-10-26"), {
  entrada: "08:00",
  saidaManha: "11:00",
  entradaTarde: "13:00",
  saida: "17:00",
});
ok("dias novos usam as horas e o intervalo configurados");

const lancamentoFracao = recalcularLancamento(
  {
    id: "d1",
    colaboradorId: "c1",
    data: "2026-10-26",
    ...horarioPorDuracao("08:00", 3, 4, 2),
    turnoManha: true,
    turnoTarde: true,
    calcularPorHora: true,
    intervaloMinutos: 120,
    horas: 0,
    valor: 0,
  },
  configDuracao
);
assert.equal(horasTrabalhadasLancamento(lancamentoFracao), 7);
assert.equal(lancamentoFracao.horas, 7);
assert.equal(lancamentoFracao.valor, 175);
ok("fração usa as horas dos turnos e deixa o intervalo de fora");

const lancamentoTurno = recalcularLancamento(
  { ...lancamentoFracao, calcularPorHora: false, valorManual: false },
  configDuracao
);
assert.equal(lancamentoTurno.valor, 200);
assert.equal(horasLancamentoDiaria(lancamentoTurno), 9);
ok("com o cálculo por hora desligado os dois turnos continuam valendo a diária inteira");

let storeDuracao: DiariasStore = {
  configs: {},
  lancamentos: [lancamentoTurno],
  despesas: {},
};
storeDuracao = atualizarConfigERecalcular(storeDuracao, {
  ...configDuracao,
  horasTurnoManha: 5,
});
assert.equal(storeDuracao.lancamentos[0].entrada, "08:00");
assert.equal(storeDuracao.lancamentos[0].saidaManha, "11:00");
assert.equal(storeDuracao.configs.c1.horasTurnoManha, 5);
ok("mudar a configuração não reescreve o horário de um dia já lançado");

assert.equal(colaboradorPodeLancarDiaria("Diária"), true);
assert.equal(colaboradorPodeLancarDiaria("Diária + Comissão"), true);
assert.equal(colaboradorPodeLancarDiaria("Daily rate"), true);
assert.equal(colaboradorPodeLancarDiaria("Comissão"), false);
assert.equal(colaboradorPodeLancarDiaria("Salário + Comissão"), false);
assert.equal(colaboradorPodeLancarDiaria("Salário"), false);
assert.equal(colaboradorPodeLancarDiaria("Commission"), false);
assert.equal(colaboradorPodeLancarDiaria(""), false);
ok("a busca da diária deixa de fora quem está cadastrado só por comissão ou salário");

console.log("todos os testes de diárias passaram");
