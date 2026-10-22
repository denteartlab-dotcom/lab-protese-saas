import assert from "node:assert/strict";
import {
  filtrarHistoricoEntregas,
  type EntregaHistorico,
} from "../src/lib/controle-entregas-historico-core";

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

console.log("filtro do historico de entregas ok");
