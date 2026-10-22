import assert from "node:assert/strict";
import { htmlEtiquetaEnvio } from "../src/lib/etiqueta-envio-entrega";
import {
  normalizarConfiguracoesEtiquetaEntrega,
  normalizarLayoutEtiquetaEntrega,
} from "../src/lib/configuracoes-etiqueta-entrega";

const textos = {
  titulo: "Etiqueta de envio",
  destinatario: "Destinatário",
  remetente: "Remetente",
  os: "OS",
  cep: "CEP",
  remetenteSemCadastro: "Sem remetente",
  imprimir: "Imprimir",
  fechar: "Fechar",
};
const base = {
  textos,
  destinatario: { nome: "João Piski", rua: "Rua das Flores", cep: "29745-000", telefone: "27999999999" },
  remetente: { nome: "DenteArt", rua: "Rua do Lab", telefone: "3333333333" },
  numeroOs: "15",
};

const oculto = htmlEtiquetaEnvio({
  ...base,
  opcoes: {
    formato: "a4",
    modeloA4: "modelo1",
    layout: normalizarLayoutEtiquetaEntrega({
      exibirDestinatario: false,
      exibirOs: false,
      exibirCep: false,
      exibirTelefone: false,
      exibirBorda: false,
      tamanhoFonte: 99,
    }),
  },
});
assert.doesNotMatch(oculto, /Destinatário/);
assert.doesNotMatch(oculto, /<p class="os">/);
assert.doesNotMatch(oculto, /29745-000/);
assert.doesNotMatch(oculto, /27999999999/);
assert.match(oculto, /Remetente/);
assert.match(oculto, /sem-borda/);
assert.match(oculto, /--escala:1\.5714285714285714|--escala:1\.57/);

const cfg = normalizarConfiguracoesEtiquetaEntrega({
  modeloPadrao: "modelo2",
  duasVias: { modelo2: true },
});
assert.equal(cfg.modeloPadrao, "modelo2");
assert.equal(cfg.duasVias.modelo2, true);
assert.equal(cfg.layouts.modelo1.exibirRemetente, true);
assert.equal(normalizarLayoutEtiquetaEntrega({ tamanhoFonte: 99 }).tamanhoFonte, 22);

console.log("modelo de etiqueta de entrega ok");
