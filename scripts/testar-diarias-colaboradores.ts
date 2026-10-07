/**
 * Testes unitários das diárias de colaboradores (horas, valor e jornada).
 */
import assert from "node:assert/strict";
import {
  atualizarConfigERecalcular,
  celulasCalendarioMes,
  criarLancamentoDiaria,
  diaDeveTrabalhar,
  formatarHorasDecimais,
  horasJornadaDaCarga,
  horasTrabalhadas,
  idDiaSemanaDeData,
  limparLancamentosMes,
  minutosLiquidosTurno,
  preencherMesComJornada,
  resumoDiariasMes,
  sugerirValorDiaria,
  valorDiariaProporcional,
  type ConfigDiariaColaborador,
  type DiariasStore,
} from "../src/lib/diarias-colaboradores";
import { clonarHorarioFuncionamento } from "../src/lib/horario-funcionamento";
import { filtroAgendaDaUrl, semanaOffsetParaData } from "../src/lib/agenda-producao";

function ok(nome: string) {
  console.log(`ok  ${nome}`);
}

assert.equal(minutosLiquidosTurno("08:00", "18:00", 60), 540);
assert.equal(horasTrabalhadas("08:00", "18:00", 60), 9);
ok("jornada 08-18 com 1h de intervalo");

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

let store: DiariasStore = { configs: { c1: config }, lancamentos: [] };
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
  saida: "12:00",
  intervaloMinutos: 0,
});
assert.equal(parcial.horas, 4);
assert.equal(parcial.valor, 80);
ok("meio período vale metade da diária");

store = atualizarConfigERecalcular(store, { ...config, valorDiaria: "200,00" });
const depois = resumoDiariasMes(store, "c1", 2026, 10);
assert.ok(depois.valor > outubro.valor);
ok("recalcula o mês ao mudar o valor da diária");

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

console.log("todos os testes de diárias passaram");
