import assert from "node:assert/strict";
import {
  cssFonteImpressao,
  fontePdfImpressao,
  usarFonteNoPdf,
} from "../src/lib/fonte-impressao";
import { normalizarConfiguracoesEtiquetas } from "../src/lib/configuracoes-etiquetas";
import { normalizarFaturaModeloLayout } from "../src/lib/fatura-modelo-layout";
import { normalizarOsModelo1Layout } from "../src/lib/os-modelo1-layout";
import { normalizarOsModelo3Layout } from "../src/lib/os-modelo3-layout";
import { normalizarOsModelo4Layout } from "../src/lib/os-modelo4-layout";
import { normalizarOsModelo5Layout } from "../src/lib/os-modelo5-layout";

assert.equal(normalizarOsModelo1Layout({}).fonte, "arial");
assert.equal(normalizarOsModelo1Layout({ fonte: "times" }).fonte, "times");
assert.equal(normalizarOsModelo1Layout({ fonte: "inexistente" as "arial" }).fonte, "arial");
assert.equal(normalizarOsModelo3Layout(null).fonte, "arial");
assert.equal(normalizarOsModelo3Layout({ fonte: "georgia" }).fonte, "georgia");
assert.equal(typeof normalizarOsModelo3Layout({ fonte: "times" }).fonte, "string");
assert.equal(normalizarOsModelo4Layout({ fonte: "courier" }).fonte, "courier");
assert.equal(normalizarOsModelo5Layout({ fonte: "verdana" }).fonte, "verdana");
assert.equal(normalizarFaturaModeloLayout({}).fonte, "arial");
assert.equal(normalizarFaturaModeloLayout({ fonte: "tahoma" }).fonte, "tahoma");
assert.equal(normalizarFaturaModeloLayout({ fonte: "times" }).infoLab, true);
assert.equal(normalizarConfiguracoesEtiquetas(null).fonte, "arial");
assert.equal(normalizarConfiguracoesEtiquetas({ fonte: "times" }).fonte, "times");
assert.equal(cssFonteImpressao("times").includes("Times New Roman"), true);
assert.equal(cssFonteImpressao("arial").includes("Arial"), true);
assert.equal(fontePdfImpressao("georgia"), "times");
assert.equal(fontePdfImpressao("times"), "times");
assert.equal(fontePdfImpressao("courier"), "courier");
assert.equal(fontePdfImpressao("verdana"), "helvetica");
assert.equal(fontePdfImpressao("tahoma"), "helvetica");
assert.equal(fontePdfImpressao("arial"), "helvetica");

const chamadas: string[] = [];
const pdf = {
  setFont(nome: string, estilo?: string) {
    chamadas.push(`${nome}:${estilo ?? ""}`);
  },
};
usarFonteNoPdf(pdf, "times");
pdf.setFont("helvetica", "bold");
pdf.setFont("courier", "italic");
assert.deepEqual(chamadas, ["times:bold", "times:italic"]);

console.log("fonte de impressao ok");
