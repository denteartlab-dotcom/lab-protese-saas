import assert from "node:assert/strict";
import {
  dividirEnderecoLivreCliente,
  enderecoCompostoCliente,
  mesclarObservacoesComEnderecoCliente,
  partesEnderecoCliente,
} from "../src/lib/cliente-endereco";
import { observacoesTextoLivreCliente } from "../src/lib/cliente-observacoes";
import { montarEntregaDeTrabalho } from "../src/lib/controle-entregas-automatico-cliente";
import {
  destinatarioDaEntrega,
  htmlEtiquetaEnvio,
  linhasEnderecoEtiqueta,
} from "../src/lib/etiqueta-envio-entrega";
import type { EntregaControle } from "../src/lib/controle-entregas";

const estruturado = partesEnderecoCliente(
  "Entregador: João\nRua: Av. Brasil\nNúmero: 48\nBairro: Centro\nComplemento: Loja",
  "48, centro, loja"
);
assert.deepEqual(estruturado, {
  rua: "Av. Brasil",
  numero: "48",
  bairro: "Centro",
  complemento: "Loja",
});

assert.deepEqual(dividirEnderecoLivreCliente("Av. Brasil, 48, Centro, Loja"), {
  rua: "Av. Brasil",
  numero: "48",
  bairro: "Centro",
  complemento: "Loja",
});

assert.deepEqual(partesEnderecoCliente(null, "48, centro, loja"), {
  rua: "",
  numero: "48",
  bairro: "centro",
  complemento: "loja",
});

const mesclado = mesclarObservacoesComEnderecoCliente("Entregador: Motoboy\nRua: Antiga", {
  rua: "Rua Nova",
  numero: "10",
  bairro: "Centro",
  complemento: "",
});
assert.match(mesclado, /Entregador: Motoboy/);
assert.match(mesclado, /Rua: Rua Nova/);
assert.equal((mesclado.match(/Rua:/g) || []).length, 1);
assert.equal(observacoesTextoLivreCliente(mesclado), "");
assert.equal(
  enderecoCompostoCliente({ rua: "Rua Nova", numero: "10", bairro: "Centro", complemento: "" }),
  "Rua Nova, 10, Centro"
);

const entregaAuto = montarEntregaDeTrabalho({
  id: "t1",
  numeroOs: 15,
  tipoProtese: "Coroa",
  cliente: {
    nome: "João Piski",
    endereco: "48, centro, loja",
    cidade: "São Domingos do Norte",
    uf: "ES",
    cep: "29745-000",
    observacoes: "Número: 48\nBairro: Centro\nComplemento: Loja\nRua: Rua das Flores",
  },
});
assert.equal(entregaAuto.rua, "Rua das Flores");
assert.equal(entregaAuto.numeroEndereco, "48");
assert.equal(entregaAuto.bairro, "Centro");
assert.equal(entregaAuto.complemento, "Loja");
assert.equal(entregaAuto.cidade, "São Domingos do Norte");

const entrega: EntregaControle = {
  id: "ent-1",
  dataPedido: new Date().toISOString(),
  destinatario: "João Piski",
  entregador: "Motoboy",
  descricao: "Coroa",
  situacao: "pendente",
  valor: 0,
  numeroOs: "15",
  nomeDestinatario: "João Piski",
  rua: "Rua das Flores",
  numeroEndereco: "48",
  bairro: "Centro",
  complemento: "Loja",
  cidade: "São Domingos do Norte",
  uf: "ES",
  cep: "29745-000",
};

assert.deepEqual(linhasEnderecoEtiqueta(destinatarioDaEntrega(entrega)).slice(0, 2), [
  "João Piski",
  "Rua das Flores, 48",
]);
assert.ok(linhasEnderecoEtiqueta(destinatarioDaEntrega(entrega)).includes("CEP 29745-000"));

const html = htmlEtiquetaEnvio({
  textos: {
    titulo: "Etiqueta de envio",
    destinatario: "Destinatário",
    remetente: "Remetente",
    os: "OS",
    cep: "CEP",
    remetenteSemCadastro: "Sem remetente",
    imprimir: "Imprimir",
    fechar: "Fechar",
  },
  destinatario: destinatarioDaEntrega(entrega),
  remetente: {
    nome: "Lab Prótese",
    rua: "Rua do Lab",
    numero: "100",
    cidade: "Colatina",
    uf: "ES",
    cep: "29700-000",
  },
  numeroOs: "15",
});
assert.match(html, /Destinatário/);
assert.match(html, /João Piski/);
assert.match(html, /Remetente/);
assert.match(html, /Lab Prótese/);
assert.match(html, /OS 15/);

console.log("endereco cliente e etiqueta de envio ok");
