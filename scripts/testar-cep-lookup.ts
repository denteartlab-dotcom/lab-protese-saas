import assert from "node:assert/strict";
import { enderecoDePayloadCep, mesclarEnderecosCep } from "../src/lib/cep-lookup";

const viaCepSemRua = enderecoDePayloadCep({
  cep: "29745-000",
  logradouro: "",
  bairro: "",
  localidade: "São Domingos do Norte",
  uf: "ES",
  ibge: "3204658",
});
assert.equal(viaCepSemRua?.cidade, "São Domingos do Norte");
assert.equal(viaCepSemRua?.rua, "");

const brasilComRua = enderecoDePayloadCep({
  cep: "01001000",
  street: "Praça da Sé",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "SP",
  ibge: { city: "3550308" },
});
assert.equal(brasilComRua?.rua, "Praça da Sé");
assert.equal(brasilComRua?.codMunicipio, "3550308");

const mesclado = mesclarEnderecosCep([
  viaCepSemRua,
  enderecoDePayloadCep({
    address: "Rua das Flores",
    district: "Centro",
    city: "São Domingos do Norte",
    state: "ES",
    code: "29745-000",
  }),
]);
assert.equal(mesclado?.rua, "Rua das Flores");
assert.equal(mesclado?.bairro, "Centro");
assert.equal(mesclado?.cidade, "São Domingos do Norte");
assert.equal(mesclado?.uf, "ES");

assert.equal(enderecoDePayloadCep({ erro: "true" }), null);
assert.equal(enderecoDePayloadCep({ erro: true }), null);
assert.equal(mesclarEnderecosCep([null, undefined]), null);

console.log("consulta de cep preenche a rua ok");
