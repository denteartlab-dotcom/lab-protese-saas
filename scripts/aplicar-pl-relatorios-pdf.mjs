#!/usr/bin/env node
/** Aplica pl() e iniciarImpressaoRelatorio nos geradores pdf-relatorio-*.ts */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libDir = path.join(__dirname, "../src/lib");

const SKIP = new Set([
  "pdf-relatorio-faturas-smart-comum.ts",
  "pdf-relatorio-tabela.ts",
]);

const IMPORT_LINE = `import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  obsFaturasSemAdiantamento,
  periodoRelatorioTexto,
  pl,
  tituloExtratoFinanceiro,
  tituloRelatorioDespesas,
  tituloRelatorioFaturas,
  tituloRelatorioParcelasAPagar,
  tituloRelatorioParcelasAReceber,
  tituloPeriodoCampo,
} from "@/lib/i18n/print-relatorio-helpers";`;

const colMap = {
  "Num Fatura": "print.relatorio.col.numFatura",
  "Núm Fatura": "print.relatorio.col.numFaturaCurto",
  "Núm. Fatura": "print.extrato.numFaturaCurto",
  "Qtd Parcelas": "print.relatorio.col.qtdParcelas",
  "Data Emissão": "print.relatorio.col.dataEmissao",
  "Cliente": "print.relatorio.cliente",
  "Valor": "print.relatorio.col.valor",
  "Recebido": "print.relatorio.col.recebido",
  "Saldo": "print.relatorio.col.saldo",
  "Parcela": "print.relatorio.col.parcela",
  "Vencimento": "print.relatorio.col.vencimento",
  "Venc.": "print.relatorio.col.venc",
  "Forma Pagamento": "print.relatorio.col.formaPagamento",
  "Forma": "print.relatorio.col.forma",
  "Juros": "print.relatorio.col.juros",
  "Descrição": "print.relatorio.col.descricao",
  "Situação": "print.relatorio.col.situacao",
  "Sit.": "print.relatorio.col.sit",
  "Data": "print.extrato.data",
  "Data Fatura": "print.extrato.dataFatura",
  "OS": "print.extrato.os",
  "Os": "print.relatorio.col.os",
  "Serviço/Produto": "print.extrato.servico",
  "Serviço / Produto": "print.extrato.servicoProdutoEspaco",
  "Qtd": "print.extrato.qtd",
  "Paciente": "print.extrato.paciente",
  "Núm Dente": "print.extrato.numDente",
  "Num Dente": "print.relatorio.col.numDente",
  "Fatura": "print.extrato.fatura",
  "Valor a Receber": "print.relatorio.col.valorAReceber",
  "Data Recebimento": "print.relatorio.col.dataRecebimento",
  "Nome": "print.relatorio.col.nome",
  "Ref": "print.relatorio.col.ref",
  "Pagamento": "print.relatorio.col.pagamento",
  "Pago": "print.relatorio.col.pago",
  "Fornecedor": "print.relatorio.col.fornecedor",
  "Referência": "print.relatorio.col.referencia",
  "Data Pagamento": "print.relatorio.col.dataPagamento",
  "Valor Parcela": "print.relatorio.col.valorParcela",
  "Num": "print.relatorio.col.num",
  "Lançamento": "print.relatorio.col.lancamento",
  "Entregue": "print.relatorio.col.entregue",
  "Comissão": "print.relatorio.col.comissao",
  "Quantidade": "print.relatorio.col.quantidade",
  "Valor Comissão": "print.relatorio.col.valorComissao",
  "Valor Comissao": "print.relatorio.col.valorComissao",
  "Data Pedido": "print.relatorio.col.dataPedido",
  "Dentista": "print.relatorio.col.dentista",
  "Valor Un": "print.relatorio.col.valorUn",
  "Subtotal": "print.relatorio.col.subtotal",
  "Un": "print.relatorio.col.un",
  "Desc": "print.relatorio.col.desc",
  "Desconto": "print.extrato.desconto",
};

const titleReplacements = [
  [
    /const titulo = `Relatório de Faturas - \(\$\{tituloPeriodoSmart\(opcoes\.periodoCampo\)\}\)`;/g,
    "const titulo = tituloRelatorioFaturas(opcoes.periodoCampo);",
  ],
  [
    /const titulo = `Relatório de Despesas - \(\$\{tituloPeriodoSmart\(opcoes\.periodoCampo\)\}\)`;/g,
    "const titulo = tituloRelatorioDespesas(opcoes.periodoCampo);",
  ],
  [
    /const titulo = `Relatório de Parcelas a Receber - \(\$\{tituloPeriodoSmart\(opcoes\.periodoCampo\)\}\)`;/g,
    "const titulo = tituloRelatorioParcelasAReceber(opcoes.periodoCampo);",
  ],
  [
    /const titulo = `Relatório de Parcelas a Pagar - \(\$\{tituloPeriodoParcelasAPagarModelo2\(periodoCampo\)\}\)`;/g,
    "const titulo = tituloRelatorioParcelasAPagar(periodoCampo);",
  ],
  [
    /const titulo = `Relatório de Parcelas a Pagar - \(\$\{tituloPeriodoSmart\(opcoes\.periodoCampo\)\}\)`;/g,
    "const titulo = tituloRelatorioParcelasAPagar(opcoes.periodoCampo);",
  ],
  [
    /const titulo = "Relatório de Parcelas Pagas - \( Data Pagamento \)";/g,
    'const titulo = pl("print.relatorio.tituloParcelasPagas");',
  ],
  [
    /const TITULO = "Relatório de Parcelas Recebidas - \(Data Recebimento\)";/g,
    'const TITULO = pl("print.relatorio.tituloParcelasRecebidas");',
  ],
  [
    /"Relatório de Parcelas Recebidas - \(Data Recebimento\)"/g,
    'pl("print.relatorio.tituloParcelasRecebidas")',
  ],
  [
    /const titulo = opts\.titulo \?\? "Relatório de Produtos";/g,
    'const titulo = opts.titulo ?? pl("print.relatorio.tituloProdutos");',
  ],
  [
    /pdf\.text\(`Extrato Financeiro \(\$\{nomeCliente\}\)`/g,
    "pdf.text(tituloExtratoFinanceiro(nomeCliente)",
  ],
  [
    /desenharTexto\(ctx, IDX_VALOR, "Saldo Anterior"/g,
    'desenharTexto(ctx, IDX_VALOR, pl("print.extrato.saldoAnterior")',
  ],
  [
    /\["\(\+\) Saldo Anterior",/g,
    '[pl("print.extrato.resumoSaldoAnterior"),',
  ],
  [
    /\["\(\+\) Total Serviços",/g,
    '[pl("print.extrato.resumoTotalServicos"),',
  ],
  [
    /\["\(-\) Total Pagamentos",/g,
    '[pl("print.extrato.resumoTotalPagamentos"),',
  ],
  [
    /\["\(-\) Total Descontos",/g,
    '[pl("print.extrato.resumoTotalDescontos"),',
  ],
  [
    /\["\(=\) Saldo Total",/g,
    '[pl("print.extrato.resumoSaldoTotal"),',
  ],
  [
    /const OBS_MODELO1 =[\s\S]*?";/g,
    "",
  ],
  [
    /const OBS_MODELO2 =[\s\S]*?";/g,
    "",
  ],
  [
    /const OBS_MODELO3 =[\s\S]*?";/g,
    "",
  ],
  [
    /desenharObservacaoFaturasSmart\(ctx, OBS_MODELO1\);/g,
    "desenharObservacaoFaturasSmart(ctx, obsFaturasSemAdiantamento());",
  ],
  [
    /desenharObservacaoFaturasSmart\(ctx, OBS_MODELO2\);/g,
    "desenharObservacaoFaturasSmart(ctx, obsFaturasSemAdiantamento());",
  ],
  [
    /desenharObservacaoFaturasSmart\(ctx, OBS_MODELO3\);/g,
    "desenharObservacaoFaturasSmart(ctx, obsFaturasSemAdiantamento(true));",
  ],
  [
    /rotulo: "TOTAL"/g,
    'rotulo: pl("print.relatorio.total")',
  ],
  [
    /rotulo: "Totais"/g,
    'rotulo: pl("print.relatorio.totais")',
  ],
  [
    /tituloRelatorio: "Curva ABC Clientes"/g,
    'tituloRelatorio: pl("print.relatorio.curvaAbc")',
  ],
  [
    /`Relatório de Comissões - \$\{periodo\} \(Serviço\)`/g,
    'pl("print.relatorio.tituloComissoesServico", { periodo })',
  ],
  [
    /`Relatório de Comissões - \$\{periodo\} \(Serviços Terceirizado\)`/g,
    'pl("print.relatorio.tituloComissoesTerceirizado", { periodo })',
  ],
  [
    /periodoCampo === "data_entrega" \? "Data Entrega" : "Data Lançamento"/g,
    'periodoCampo === "data_entrega" ? tituloPeriodoCampo("data_entrega") : tituloPeriodoCampo("data_lancamento")',
  ],
  [
    /`\$\{opcoes\.dataInicio\} à \$\{opcoes\.dataFinal\}`/g,
    "periodoRelatorioTexto(opcoes.dataInicio, opcoes.dataFinal)",
  ],
];

function applyColMap(content) {
  let c = content;
  const sorted = Object.keys(colMap).sort((a, b) => b.length - a.length);
  for (const pt of sorted) {
    const key = colMap[pt];
    c = c.replaceAll(`titulo: "${pt}"`, `titulo: pl("${key}")`);
  }
  return c;
}

function ensureImport(content) {
  if (content.includes("print-relatorio-helpers")) return content;
  const firstImport = content.match(/^import .+$/m);
  if (firstImport) {
    return content.replace(firstImport[0], `${firstImport[0]}\n${IMPORT_LINE}`);
  }
  return `${IMPORT_LINE}\n${content}`;
}

function ensureIniciar(content) {
  if (content.includes("iniciarImpressaoRelatorio()")) return content;
  return content.replace(
    /export async function (gerar[A-Za-z0-9]+Pdf)\([^)]*\)[^{]*\{/g,
    (m) => `${m}\n  iniciarImpressaoRelatorio();`
  );
}

const files = fs
  .readdirSync(libDir)
  .filter((f) => f.startsWith("pdf-relatorio-") && f.endsWith(".ts") && !SKIP.has(f));

let updated = 0;
for (const file of files) {
  const full = path.join(libDir, file);
  let c = fs.readFileSync(full, "utf8");
  const original = c;
  c = ensureImport(c);
  c = applyColMap(c);
  for (const [re, rep] of titleReplacements) {
    c = c.replace(re, rep);
  }
  c = ensureIniciar(c);
  if (c !== original) {
    fs.writeFileSync(full, c);
    updated++;
    console.log("updated", file);
  }
}

// relatorios-impressao-pdf.ts
const relFile = path.join(libDir, "relatorios-impressao-pdf.ts");
let rel = fs.readFileSync(relFile, "utf8");
const relOrig = rel;
if (!rel.includes("print-relatorio-helpers")) {
  rel = rel.replace(
    'import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";',
    `import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  pl,
  tituloPeriodoCampo,
} from "@/lib/i18n/print-relatorio-helpers";`
  );
}
rel = rel.replace(
  /function money\(value: number\) \{[\s\S]*?\}/,
  "function money(value: number) {\n  return moneyRelatorio(value);\n}"
);
rel = applyColMap(rel);
rel = rel.replace(
  /export async function gerarCurvaAbcClientesPdf\(/,
  "export async function gerarCurvaAbcClientesPdf("
);
if (!rel.includes("iniciarImpressaoRelatorio()")) {
  rel = rel.replace(
    /export async function (gerar[A-Za-z0-9]+Pdf)\([^)]*\)[^{]*\{/g,
    (m) => `${m}\n  iniciarImpressaoRelatorio();`
  );
}
rel = rel.replace(
  /tituloRelatorio: "Curva ABC Clientes"/g,
  'tituloRelatorio: pl("print.relatorio.curvaAbc")'
);
rel = rel.replace(
  /tituloRelatorio: `Relatório Receitas — \$\{tituloModelo\}`/g,
  'tituloRelatorio: pl("print.relatorio.tituloReceitas", { modelo: tituloModelo })'
);
rel = rel.replace(
  /tituloRelatorio: `Relatório Despesas — \$\{tituloModelo\}`/g,
  'tituloRelatorio: pl("print.relatorio.tituloDespesasModelo", { modelo: tituloModelo })'
);
rel = rel.replace(/rotulo: "TOTAL"/g, 'rotulo: pl("print.relatorio.total")');
rel = rel.replace(/rotulo: "Totais"/g, 'rotulo: pl("print.relatorio.totais")');
if (rel !== relOrig) {
  fs.writeFileSync(relFile, rel);
  console.log("updated relatorios-impressao-pdf.ts");
}

console.log(`Done. ${updated} pdf-relatorio files updated.`);
