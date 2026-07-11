#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/pdf-fatura-impressao.ts");
let c = fs.readFileSync(file, "utf8");

if (!c.includes("print-relatorio-helpers")) {
  c = c.replace(
    'import { desenharCabecalhoRequisicaoPdf, type PdfCabecalhoApi } from "@/lib/pdf-cabecalho-os";',
    `import { desenharCabecalhoRequisicaoPdf, type PdfCabecalhoApi } from "@/lib/pdf-cabecalho-os";
import { iniciarImpressaoRelatorio, pl } from "@/lib/i18n/print-relatorio-helpers";`
  );
}

if (!c.includes("function rotuloFatura")) {
  c = c.replace(
    "type ColunaFatura = {",
    `function rotuloFatura(chave: Parameters<typeof pl>[0]) {
  return \`\${pl(chave)}: \`;
}

type ColunaFatura = {`
  );
}

c = c.replace(
  `const COLUNAS_SMART: ColunaFatura[] = [
  { chave: "numOs", titulo: "OS", larguraPct: 5, align: "left" },
  { chave: "qtd", titulo: "Qtd", larguraPct: 5, align: "center" },
  { chave: "servico", titulo: "Serviços/Produtos", larguraPct: 22, align: "left" },
  { chave: "numDente", titulo: "Num Dente", larguraPct: 11, align: "left" },
  { chave: "paciente", titulo: "Paciente", larguraPct: 13, align: "left" },
  { chave: "valorUnit", titulo: "Unitário", larguraPct: 13, align: "right" },
  { chave: "desconto", titulo: "Desc", larguraPct: 9, align: "right" },
  { chave: "subtotal", titulo: "Subtotal", larguraPct: 13, align: "right" },
];`,
  `function colunasSmart(): ColunaFatura[] {
  return [
    { chave: "numOs", titulo: pl("print.fatura.col.os"), larguraPct: 5, align: "left" },
    { chave: "qtd", titulo: pl("print.fatura.col.qtd"), larguraPct: 5, align: "center" },
    { chave: "servico", titulo: pl("print.fatura.col.servicos"), larguraPct: 22, align: "left" },
    { chave: "numDente", titulo: pl("print.fatura.col.numDente"), larguraPct: 11, align: "left" },
    { chave: "paciente", titulo: pl("print.fatura.col.paciente"), larguraPct: 13, align: "left" },
    { chave: "valorUnit", titulo: pl("print.fatura.col.unitario"), larguraPct: 13, align: "right" },
    { chave: "desconto", titulo: pl("print.fatura.col.desconto"), larguraPct: 9, align: "right" },
    { chave: "subtotal", titulo: pl("print.fatura.col.subtotal"), larguraPct: 13, align: "right" },
  ];
}`
);

c = c.replaceAll("COLUNAS_SMART", "colunasSmart()");

c = c.replace(
  `function formatarMoedaPdf(valor: number) {
  return \`R$ \${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}\`;
}`,
  `function formatarMoedaPdf(valor: number) {
  return formatMoneyImpressao(valor);
}`
);

if (!c.includes("definirLocaleImpressao")) {
  c = c.replace(
    'import { formatMoneyImpressao } from "@/lib/i18n/print-i18n";',
    `import { definirLocaleImpressao, formatMoneyImpressao, resolverLocaleImpressao } from "@/lib/i18n/print-i18n";`
  );
}

if (!c.includes("definirLocaleImpressao(resolverLocaleImpressao")) {
  c = c.replace(
    `  const cfgLab =
    opts.cfgLab ??
    (typeof window !== "undefined" ? carregarConfigLaboratorio() : CONFIG_LAB_PADRAO);
  const { jsPDF } = await import("jspdf");`,
    `  const cfgLab =
    opts.cfgLab ??
    (typeof window !== "undefined" ? carregarConfigLaboratorio() : CONFIG_LAB_PADRAO);
  definirLocaleImpressao(resolverLocaleImpressao({ configLab: cfgLab }));
  const { jsPDF } = await import("jspdf");`
  );
}

const subs = [
  ['pdf.text(`Data: ${', 'pdf.text(`${pl("print.fatura.data")}: ${'],
  ['pdf.text(`Usuário: ${', 'pdf.text(`${pl("print.fatura.usuario")}: ${'],
  ['labelValue(pdf, "Cliente: ",', 'labelValue(pdf, rotuloFatura("print.fatura.cliente"),'],
  ['labelValue(pdf, "Telefones: ",', 'labelValue(pdf, rotuloFatura("print.fatura.telefones"),'],
  ['labelValue(pdf, "Último Pgto: ",', 'labelValue(pdf, `${pl("print.fatura.ultimoPgto")}: `,'],
  ['labelValue(pdf, "Saldo Anterior: ",', 'labelValue(pdf, rotuloFatura("print.fatura.saldoAnterior"),'],
  ['labelValue(pdf, "OS Externa: ",', 'labelValue(pdf, rotuloFatura("print.fatura.osExterna"),'],
  ['labelValue(pdf, "Email: ",', 'labelValue(pdf, rotuloFatura("print.fatura.email"),'],
  ['labelValue(pdf, "Endereço: ",', 'labelValue(pdf, rotuloFatura("print.fatura.endereco"),'],
  ['tituloDireita: "Fatura"', 'tituloDireita: pl("print.fatura.titulo")'],
  ['? "Total Serviços/Produtos (=)"', '? pl("print.fatura.totalServicosProdutos")'],
  ['? "Total Serviços (=)"', '? pl("print.fatura.totalServicosIgual")'],
  [': "Total Serviços (+)"', ': pl("print.fatura.totalServicos")'],
  ['linhaTotal("Saldo Anterior (+)",', 'linhaTotal(pl("print.fatura.saldoAnteriorMais"),'],
  ['linhaTotal("Desconto Serviços (-)",', 'linhaTotal(pl("print.fatura.descontoServicos"),'],
  ['linhaTotal("Desconto Fatura (-)",', 'linhaTotal(pl("print.fatura.descontoFatura"),'],
  ['linhaTotal("Juros Fatura (+)",', 'linhaTotal(pl("print.fatura.jurosFatura"),'],
  ['linhaTotal("Total (=)",', 'linhaTotal(pl("print.fatura.total"),'],
  ['pdf.text("Condição de Pagamento",', 'pdf.text(pl("print.fatura.condicaoPagamento"),'],
  ['{ titulo: "Parcela",', '{ titulo: pl("print.fatura.col.parcela"),'],
  ['{ titulo: "Vencimento",', '{ titulo: pl("print.fatura.col.vencimento"),'],
  ['{ titulo: "Forma Pagto",', '{ titulo: pl("print.fatura.col.formaPagto"),'],
  ['{ titulo: "Valor",', '{ titulo: pl("print.fatura.col.valor"),'],
  ['{ titulo: "Pago",', '{ titulo: pl("print.fatura.col.pago"),'],
  ['col.titulo === "Pago"', 'col.titulo === pl("print.fatura.col.pago")'],
  ['pdf.text(`Observação: ${', 'pdf.text(`${pl("print.fatura.observacao")}: ${'],
  ['pdf.text("Recebi o(s) serviço(s) descritos acima",', 'pdf.text(pl("print.fatura.assinatura"),'],
  ['pdf.text("Pagar com PIX",', 'pdf.text(pl("print.fatura.pagarPix"),'],
];

for (const [from, to] of subs) {
  if (c.includes(from)) {
    c = c.replaceAll(from, to);
    console.log(`OK: ${from.slice(0, 45)}`);
  } else {
    console.log(`SKIP: ${from.slice(0, 45)}`);
  }
}

fs.writeFileSync(file, c);
console.log("pdf-fatura-impressao i18n aplicado");
