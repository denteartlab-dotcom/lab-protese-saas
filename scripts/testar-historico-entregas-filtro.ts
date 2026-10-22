import assert from "node:assert/strict";
import {
  entregaParaHistorico,
  filtrarHistoricoEntregas,
  normalizarHistorico,
  type EntregaHistorico,
} from "../src/lib/controle-entregas-historico-core";
import type { EntregaControle } from "../src/lib/controle-entregas";

function item(
  parcial: Partial<EntregaHistorico> &
    Pick<EntregaHistorico, "id" | "destinatario" | "dataFinalizado">
): EntregaHistorico {
  return {
    numeroOs: "1",
    descricao: "",
    entregador: "",
    situacao: "entregue",
    valor: 0,
    ordensServico: [],
    ...parcial,
  };
}

const lista = [
  item({
    id: "1",
    destinatario: "Delvane Freitas",
    numeroOs: "33",
    dataFinalizado: "2026-07-13T15:00:00.000Z",
  }),
  item({
    id: "2",
    destinatario: "João Piski",
    numeroOs: "21",
    dataFinalizado: "2026-07-13T18:00:00.000Z",
  }),
  item({
    id: "3",
    destinatario: "Delvane Freitas",
    numeroOs: "40",
    dataFinalizado: "2026-08-02T15:00:00.000Z",
  }),
];

assert.equal(filtrarHistoricoEntregas(lista, {}).length, 3);
assert.deepEqual(
  filtrarHistoricoEntregas(lista, { cliente: "Delvane Freitas" }).map((entrega) => entrega.numeroOs),
  ["33", "40"]
);
assert.deepEqual(
  filtrarHistoricoEntregas(lista, {
    cliente: "Delvane Freitas",
    dataInicio: "01/08/2026",
    dataFim: "02/08/2026",
  }).map((entrega) => entrega.id),
  ["3"]
);
assert.equal(
  filtrarHistoricoEntregas(lista, { dataInicio: "14/07/2026", dataFim: "31/07/2026" }).length,
  0
);
assert.equal(filtrarHistoricoEntregas(lista, { dataFim: "13/07/2026" }).length, 2);

const antigo = normalizarHistorico({
  id: "hist-33",
  destinatario: "Delvani Freitas",
  numeroOs: "33",
  descricao: "Protese total",
  dataFinalizado: "2026-07-13T23:03:00.000Z",
  situacao: "entregue",
});
assert.equal(antigo?.ordensServico.length, 1);
assert.equal(antigo?.ordensServico[0]?.numeroOs, "33");
assert.equal(antigo?.ordensServico[0]?.descricao, "Protese total");

const pedido: EntregaControle = {
  id: "ent-1",
  dataPedido: "2026-10-22T12:00:00.000Z",
  destinatario: "João Piski",
  entregador: "",
  descricao: "",
  situacao: "entregue",
  valor: 0,
  numeroOs: "123, 119",
  ordensServico: [
    { numeroOs: "123", descricao: "Coroa", paciente: "Ana", trabalhoId: "t1" },
    { numeroOs: "119", descricao: "Prótese", paciente: "Ana", trabalhoId: "t2" },
  ],
};
const gravado = entregaParaHistorico(pedido, { situacao: "entregue" });
assert.equal(gravado.ordensServico.length, 2);
assert.deepEqual(
  gravado.ordensServico.map((ordem) => ordem.descricao),
  ["Coroa", "Prótese"]
);
assert.equal(normalizarHistorico(gravado)?.numeroOs, "123, 119");

console.log("filtro do historico de entregas ok");
