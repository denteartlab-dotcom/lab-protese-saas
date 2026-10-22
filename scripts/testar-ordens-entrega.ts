import assert from "node:assert/strict";
import {
  entregaJaExisteParaOs,
  filtrarEntregasPorNumeroOs,
} from "../src/lib/controle-entregas-automatico-cliente";
import {
  formRotaParaEntrega,
  numerosOsDaEntrega,
  ordensServicoDaEntrega,
  textoNumerosOs,
  type EntregaControle,
  type FormRotaEntrega,
} from "../src/lib/controle-entregas";

const agrupada: EntregaControle = {
  id: "ent-1",
  dataPedido: "2026-10-22T12:00:00.000Z",
  destinatario: "Delvane Freitas",
  entregador: "",
  descricao: "",
  situacao: "pendente",
  valor: 0,
  numeroOs: "33, 21",
  ordensServico: [
    { numeroOs: "33", descricao: "Prótese total", paciente: "Ana", trabalhoId: "t1" },
    { numeroOs: "21", descricao: "Protocolo", paciente: "Leo", trabalhoId: "t2" },
  ],
};

assert.deepEqual(numerosOsDaEntrega(agrupada), ["33", "21"]);
assert.equal(entregaJaExisteParaOs([agrupada], 33), true);
assert.equal(entregaJaExisteParaOs([agrupada], 33, "ent-1"), false);
assert.equal(entregaJaExisteParaOs([agrupada], 99), false);

const semA21 = filtrarEntregasPorNumeroOs([agrupada], 21);
assert.equal(semA21.length, 1);
assert.equal(semA21[0].numeroOs, "33");
assert.deepEqual(
  semA21[0].ordensServico?.map((ordem) => ordem.numeroOs),
  ["33"]
);
assert.equal(filtrarEntregasPorNumeroOs(semA21, 33).length, 0);

const legado = ordensServicoDaEntrega({ numeroOs: "15" });
assert.deepEqual(legado, [
  { numeroOs: "15", descricao: "", paciente: "", trabalhoId: "" },
]);

const form = {
  numeroOs: "",
  ordensServico: agrupada.ordensServico || [],
  tipoDestinatario: "cliente",
  nomeDestinatario: "Delvane Freitas",
  cep: "",
  rua: "",
  numeroEndereco: "",
  cidade: "",
  uf: "",
  bairro: "",
  complemento: "",
  entregador: "",
  dataEntrega: "22/10/2026",
  hora: "09:00",
  valor: "R$ 0,00",
  tipoEntregador: "",
  descricao: "",
  observacao: "",
  situacao: "pendente",
} satisfies FormRotaEntrega;

const payload = formRotaParaEntrega(form, () => 0);
assert.equal(payload.destinatario, "Delvane Freitas");
assert.equal(payload.numeroOs, "33, 21");
assert.equal(textoNumerosOs(payload.ordensServico || []), "33, 21");
assert.equal(payload.ordensServico?.length, 2);

console.log("ordens agrupadas na entrega ok");
