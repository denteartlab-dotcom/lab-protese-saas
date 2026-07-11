#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/app/trabalhos/[id]/imprimir/pdf-os-viewer.tsx"
);
let c = fs.readFileSync(file, "utf8");

if (!c.includes("formatMoneyImpressao")) {
  c = c.replace(
    'import { iniciarImpressaoRelatorio, pl } from "@/lib/i18n/print-relatorio-helpers";',
    `import { iniciarImpressaoRelatorio, pl } from "@/lib/i18n/print-relatorio-helpers";
import type { PrintMessageKey } from "@/lib/i18n/messages-print";
import { formatMoneyImpressao } from "@/lib/i18n/print-i18n";

function rotuloOs(chave: PrintMessageKey) {
  return \`\${pl(chave)}:\`;
}
function rotuloOsEspaco(chave: PrintMessageKey) {
  return \`\${pl(chave)}: \`;
}`
  );
}

c = c.replace(
  `function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function unitarioTabela(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}`,
  `function money(value: number) {
  return formatMoneyImpressao(value);
}

function unitarioTabela(value: number) {
  return formatMoneyImpressao(value, undefined, false);
}`
);

const subs = [
  ['labelValue(pdf, "Produção: ",', 'labelValue(pdf, rotuloOsEspaco("print.os.producao"),'],
  ['? "Recebi o(s) serviço(s) descritos acima"', '? pl("print.os.recebiServicos")'],
  ['desenharRotuloValorDireita("Data: ",', 'desenharRotuloValorDireita(rotuloOsEspaco("print.os.data"),'],
  ['desenharRotuloValorDireita("Status: ",', 'desenharRotuloValorDireita(rotuloOsEspaco("print.os.status"),'],
  ['desenharRotuloValorDireita("Usuário: ",', 'desenharRotuloValorDireita(rotuloOsEspaco("print.os.usuario"),'],
  ['tituloDireita: "Ordem de Serviço"', 'tituloDireita: pl("print.os.titulo")'],
  ['labelValue(pdf, "Núm OS:",', 'labelValue(pdf, rotuloOs("print.os.numOs"),'],
  ['pdf.text("OS Externa:", colDir, y)', 'pdf.text(rotuloOs("print.os.osExterna"), colDir, y)'],
  ['colDir + pdf.getTextWidth("OS Externa:") + 1.5', 'colDir + pdf.getTextWidth(rotuloOs("print.os.osExterna")) + 1.5'],
  ['labelValue(pdf, "Cliente:",', 'labelValue(pdf, rotuloOs("print.os.cliente"),'],
  ['labelValue(pdf, "Caixa:",', 'labelValue(pdf, rotuloOs("print.os.caixa"),'],
  ['labelValue(pdf, "Dentista:",', 'labelValue(pdf, rotuloOs("print.os.dentista"),'],
  ['pdf.text(`Telefones: ${data.telefones}`, colDir, y)', 'pdf.text(`${rotuloOs("print.os.telefones")} ${data.telefones}`, colDir, y)'],
  ['labelValue(pdf, "Paciente:",', 'labelValue(pdf, rotuloOs("print.os.paciente"),'],
  ['pdf.text(`Endereço: ${data.endereco}`, colDir, y)', 'pdf.text(`${rotuloOs("print.os.endereco")} ${data.endereco}`, colDir, y)'],
  ['pdf.text(`Email: ${data.email}`,', 'pdf.text(`${rotuloOs("print.os.email")} ${data.email}`,'],
  ['pdf.text("Email:", colDir, y)', 'pdf.text(rotuloOs("print.os.email"), colDir, y)'],
  ['colDir + pdf.getTextWidth("Email:") + 1.5', 'colDir + pdf.getTextWidth(rotuloOs("print.os.email")) + 1.5'],
  ['pdf.text("Qtd", colQtd, y)', 'pdf.text(pl("print.os.qtd"), colQtd, y)'],
  ['pdf.text("Descrição", colDesc, y)', 'pdf.text(pl("print.os.descricao"), colDesc, y)'],
  ['pdf.text("Número Dente", colDente, y, { align: "center" })', 'pdf.text(pl("print.os.dente"), colDente, y, { align: "center" })'],
  ['pdf.text("Cor", colCor, y, { align: "center" })', 'pdf.text(pl("print.os.cor"), colCor, y, { align: "center" })'],
  ['pdf.text("Unitário", colUnit, y, { align: "right" })', 'pdf.text(pl("print.os.unitario"), colUnit, y, { align: "right" })'],
  ['pdf.text("Desc", colDescPct, y, { align: "right" })', 'pdf.text(pl("print.os.desc"), colDescPct, y, { align: "right" })'],
  ['pdf.text("Subtotal", colSubtotalDir, y, { align: "right" })', 'pdf.text(pl("print.os.subtotal"), colSubtotalDir, y, { align: "right" })'],
  ['pdf.text("Subtotal", colSubtotal, y, { align: "right" })', 'pdf.text(pl("print.os.subtotal"), colSubtotal, y, { align: "right" })'],
  ['labelValue(pdf, "Materiais: ",', 'labelValue(pdf, rotuloOsEspaco("print.os.materiais"),'],
  ['labelValue(pdf, "Observação: ",', 'labelValue(pdf, rotuloOsEspaco("print.os.observacao"),'],
  ['labelValue(pdf, "Peças: ",', 'labelValue(pdf, rotuloOsEspaco("print.os.pecas"),'],
  ['pdf.text(`Total ${money(data.valor)}`,', 'pdf.text(`${pl("print.os.total")} ${money(data.valor)}`,'],
  ['pdf.text("TOTAL SERVIÇOS", blocoTotalX, y)', 'pdf.text(pl("print.os.totalServicos"), blocoTotalX, y)'],
  ['pdf.text("(-) DESCONTOS", blocoTotalX, y)', 'pdf.text(pl("print.os.descontos"), blocoTotalX, y)'],
  ['pdf.text("(=) TOTAL", blocoTotalX, y)', 'pdf.text(pl("print.os.totalFinal"), blocoTotalX, y)'],
  ['pdf.text("Materiais:", m.conteudoEsq, y)', 'pdf.text(rotuloOs("print.os.materiais"), m.conteudoEsq, y)'],
  ['m.conteudoEsq + pdf.getTextWidth("Materiais:") + 2', 'm.conteudoEsq + pdf.getTextWidth(rotuloOs("print.os.materiais")) + 2'],
  ['pdf.text("Observação:", m.conteudoEsq, y)', 'pdf.text(rotuloOs("print.os.observacao"), m.conteudoEsq, y)'],
  ['y = campoTermica(pdf, "Conta:",', 'y = campoTermica(pdf, rotuloOs("print.os.conta"),'],
  ['y = campoTermica(pdf, "Num OS:",', 'y = campoTermica(pdf, rotuloOs("print.os.numOs"),'],
  ['y = campoTermica(pdf, "OS Externa:",', 'y = campoTermica(pdf, rotuloOs("print.os.osExterna"),'],
  ['y = campoTermica(pdf, "OS Interna:",', 'y = campoTermica(pdf, rotuloOs("print.os.osInterna"),'],
  ['y = campoTermica(pdf, "Telefones:",', 'y = campoTermica(pdf, rotuloOs("print.os.telefones"),'],
  ['y = campoTermica(pdf, "Endereço:",', 'y = campoTermica(pdf, rotuloOs("print.os.endereco"),'],
  ['y = campoTermica(pdf, "Chave Ped:",', 'y = campoTermica(pdf, rotuloOs("print.os.chavePed"),'],
  ['y = campoTermica(pdf, "Usuário:",', 'y = campoTermica(pdf, rotuloOs("print.os.usuario"),'],
  ['pdf.text("Unitário", colValorUn, y, { align: "right" })', 'pdf.text(pl("print.os.unitario"), colValorUn, y, { align: "right" })'],
  ['pdf.text("Descontos", colDescPct, y, { align: "right" })', 'pdf.text(pl("print.os.descontosCol"), colDescPct, y, { align: "right" })'],
  ['pdf.text("Materiais:", mx, y)', 'pdf.text(rotuloOs("print.os.materiais"), mx, y)'],
  ['mx + pdf.getTextWidth("Materiais:") + 1', 'mx + pdf.getTextWidth(rotuloOs("print.os.materiais")) + 1'],
  ['pdf.text("Observação:", mx, y)', 'pdf.text(rotuloOs("print.os.observacao"), mx, y)'],
  ['mx + pdf.getTextWidth("Observação:") + 1', 'mx + pdf.getTextWidth(rotuloOs("print.os.observacao")) + 1'],
  ['pdf.text("recebi o(s) serviço(s) descrito acima", cx, y, { align: "center" })', 'pdf.text(pl("print.os.recebiServicos"), cx, y, { align: "center" })'],
  ['"Cliente: "', 'rotuloOsEspaco("print.os.cliente")'],
  ['"Paciente: "', 'rotuloOsEspaco("print.os.paciente")'],
  ['>Baixar<', '>{pl("print.comum.baixar")}<'],
  ['>Imprimir<', '>{pl("print.comum.imprimir")}<'],
  ['>Nova aba<', '>{pl("print.comum.novaAba")}<'],
  ['>Tentar novamente<', '>{pl("print.comum.tentarNovamente")}<'],
  [': "Não foi possível gerar o PDF da requisição."', ': pl("print.os.erroGerarPdf")'],
  ['<h1 className="text-sm font-semibold">OS {data.numeroOs} — PDF</h1>', '<h1 className="text-sm font-semibold">{pl("print.os.tituloOsPdf", { n: data.numeroOs })}</h1>'],
  ['? `Etiqueta — ${nomeModeloEtiqueta(modeloEtiquetaValido(modelo) ? modelo : "slk-54x101")}`', '? pl("print.os.subtituloEtiqueta", { modelo: nomeModeloEtiqueta(modeloEtiquetaValido(modelo) ? modelo : "slk-54x101") })'],
  ['? "Comprovante de entrega (A4) — Modelo 3"', '? pl("print.os.subtituloComprovanteA4")'],
  ['? "Comprovante de entrega — Térmica 80mm (Modelo 4)"', '? pl("print.os.subtituloTermica4")'],
  ['? "Comprovante de entrega — Térmica 80mm (Modelo 5)"', '? pl("print.os.subtituloTermica5")'],
  ['? "Ordem de Serviço — Modelo 2 (Produção)"', '? pl("print.os.subtituloModelo2")'],
  ['? "Ordem de Serviço — Modelo 1 (Produção)"', '? pl("print.os.subtituloModelo1")'],
  [': "Ordem de Serviço"}', ': pl("print.os.titulo")}'],
  ['pdf.text("Descrição", mx + 10, y)', 'pdf.text(pl("print.os.descricao"), mx + 10, y)'],
  ['pdf.text("Qtd", mx, y)', 'pdf.text(pl("print.os.qtd"), mx, y)'],
];

for (const [from, to] of subs) {
  const count = c.split(from).length - 1;
  if (count > 0) {
    c = c.replaceAll(from, to);
    console.log(`OK (${count}x): ${from.slice(0, 50)}...`);
  } else {
    console.log(`SKIP: ${from.slice(0, 50)}...`);
  }
}

fs.writeFileSync(file, c);
console.log("pdf-os-viewer i18n completo aplicado");
