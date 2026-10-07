/**
 * Testes unitários da comissão de colaboradores (mês, etapa, R$/% e vencimento).
 */
import assert from "node:assert/strict";
import {
  dataVencimentoComissaoMensal,
  diaPagamentoComissaoNormalizado,
  mesCompetenciaDeData,
  referenciaDespesaComissaoColaborador,
  slugColaboradorComissao,
} from "../src/lib/comissao-colaboradores-pagamento";
import {
  calcularValorComissaoColaborador,
  montarLinhasComissaoColaboradores,
  type TrabalhoComissao,
} from "../src/lib/comissoes-colaboradores";
import type { ColaboradorListagem } from "../src/lib/colaboradores-listagem";

function cadastro(parcial: Partial<ColaboradorListagem> = {}): ColaboradorListagem {
  return {
    id: "1",
    nome: "João",
    comissaoPercentual: "10,00",
    comissaoRepeticao: "0,00",
    padraoComissao: "Nao",
    tipoContratacao: "Comissão",
    tipoValorComissao: "%",
    tipoValorComissaoRepeticao: "%",
    diaPagamentoComissao: 10,
    ...parcial,
  };
}

function trabalho(parcial: Partial<TrabalhoComissao> = {}): TrabalhoComissao {
  return {
    id: "t1",
    numeroOs: 55,
    tipoProtese: "PPR",
    valor: 490,
    status: "finalizado",
    instrucoes: [
      "Item adicionado: PPR - dentes 11 - cor A2 - qtd 1 - valor 490,00",
      "Colaborador João: comissão R$ 49,00 - etapa Gesso",
      "Etapa Gesso: resp. João - prazo 01/10/2026",
    ].join("\n"),
    dataEntrada: "2026-10-01",
    dataEntrega: "2026-10-05",
    cliente: { nome: "Cliente" },
    paciente: { nome: "Paciente" },
    segmentoFaturamento: "servico",
    ...parcial,
  };
}

function ok(nome: string) {
  console.log(`ok  ${nome}`);
}

const rs = calcularValorComissaoColaborador(490, "R$ 49,00");
assert.equal(rs.tipo, "R$");
assert.equal(rs.valor, 49);
ok("comissao em R$ da OS");

const pct = calcularValorComissaoColaborador(500, "10%");
assert.equal(pct.tipo, "%");
assert.equal(pct.valor, 50);
ok("comissao percentual da OS");

const cadastroRs = calcularValorComissaoColaborador(200, "", cadastro({
  comissaoPercentual: "25,00",
  tipoValorComissao: "R$",
}));
assert.equal(cadastroRs.valor, 25);
ok("fallback R$ do cadastro");

assert.equal(diaPagamentoComissaoNormalizado(""), 10);
assert.equal(diaPagamentoComissaoNormalizado(31), 28);
assert.equal(diaPagamentoComissaoNormalizado("5"), 5);
ok("dia de pagamento 1-28 com padrao 10");

assert.equal(dataVencimentoComissaoMensal("2026-10", 10), "2026-11-10");
assert.equal(dataVencimentoComissaoMensal("2026-12", 10), "2027-01-10");
assert.equal(mesCompetenciaDeData(new Date(2026, 9, 5)), "2026-10");
assert.equal(slugColaboradorComissao("João Silva"), "joao-silva");
assert.equal(
  referenciaDespesaComissaoColaborador("João Silva", "2026-10"),
  "comissao-colab:joao-silva:2026-10"
);
ok("vencimento no mes seguinte e referencia da despesa");

const chaveItem = "t1:t1-0";
const pendente = montarLinhasComissaoColaboradores([trabalho({ status: "pedido" })], {
  cadastro: [cadastro()],
  mapaEtapasConcluidas: {},
});
assert.equal(pendente.length, 0);
ok("esconde comissao enquanto a etapa nao foi concluida");

const concluida = montarLinhasComissaoColaboradores([trabalho({ status: "pedido" })], {
  cadastro: [cadastro()],
  mapaEtapasConcluidas: { [chaveItem]: [0] },
});
assert.equal(concluida.length, 1);
assert.equal(concluida[0].comissaoValor, 49);
assert.equal(concluida[0].etapaFinalizada, true);
assert.equal(concluida[0].mesCompetencia, "2026-10");
ok("mostra valor da OS quando a etapa e finalizada");

const semEtapaRecebido = montarLinhasComissaoColaboradores(
  [
    trabalho({
      status: "recebido",
      instrucoes: [
        "Item adicionado: PPR - dentes 11 - cor A2 - qtd 1 - valor 490,00",
        "Colaborador João: comissão R$ 49,00",
      ].join("\n"),
    }),
  ],
  { cadastro: [cadastro()], mapaEtapasConcluidas: {} }
);
assert.equal(semEtapaRecebido.length, 0);
ok("OS recebida sem etapa so aparece depois de finalizada");

const semEtapaFinalizado = montarLinhasComissaoColaboradores(
  [
    trabalho({
      status: "finalizado",
      instrucoes: [
        "Item adicionado: PPR - dentes 11 - cor A2 - qtd 1 - valor 490,00",
        "Colaborador João: comissão 10%",
      ].join("\n"),
    }),
  ],
  { cadastro: [cadastro()], mapaEtapasConcluidas: {} }
);
assert.equal(semEtapaFinalizado.length, 1);
assert.equal(semEtapaFinalizado[0].comissaoValor, 49);
ok("OS finalizada sem etapa usa percentual/R$ gravado na OS");

const finalizadoEtapaPendente = montarLinhasComissaoColaboradores([trabalho()], {
  cadastro: [cadastro()],
  mapaEtapasConcluidas: {},
});
assert.equal(finalizadoEtapaPendente.length, 1);
assert.equal(finalizadoEtapaPendente[0].comissaoValor, 49);
assert.equal(finalizadoEtapaPendente[0].etapaFinalizada, false);
ok("OS finalizada mostra a comissao da OS mesmo sem etapa marcada no modulo");

const mapaChaveLegada = montarLinhasComissaoColaboradores(
  [trabalho({ status: "producao" })],
  { cadastro: [cadastro()], mapaEtapasConcluidas: { "t1:outro-item": [0] } }
);
assert.equal(mapaChaveLegada.length, 1);
assert.equal(mapaChaveLegada[0].comissaoValor, 49);
ok("reconhece etapa concluida pela OS mesmo com chave de item diferente");

console.log("\nTodos os testes de comissao de colaboradores passaram.");
