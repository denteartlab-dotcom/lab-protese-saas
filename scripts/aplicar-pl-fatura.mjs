#!/usr/bin/env node
/** Aplica pl() nos rótulos de impressão da fatura HTML. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/lib/fatura-impressao-html.ts");
let c = fs.readFileSync(file, "utf8");

if (!c.includes("definirLocaleImpressao")) {
  c = c.replace(
    'import { resolverDataFinalizadoImpressao } from "@/lib/os-itens-impressao";',
    `import { resolverDataFinalizadoImpressao } from "@/lib/os-itens-impressao";
import {
  definirLocaleImpressao,
  pl,
  resolverLocaleImpressao,
} from "@/lib/i18n/print-i18n";
import type { Locale } from "@/lib/i18n";`
  );

  c = c.replace(
    "export type OpcoesHtmlFaturaImpressao = {\n  formato: \"a4\" | \"termica\";",
    `export type OpcoesHtmlFaturaImpressao = {\n  formato: "a4" | "termica";\n  /** Idioma dos rótulos impressos. */\n  locale?: Locale;`
  );

  c = c.replace(
    `export function gerarHtmlFaturaImpressao(
  dados: DadosFaturaImpressao,
  cfgLab: ConfigLaboratorio,
  cfgFaturas: ConfiguracoesFaturas,
  opcoes: OpcoesHtmlFaturaImpressao,
  money: (n: number) => string = (n) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
) {
  const dadosImpressao`,
    `export function gerarHtmlFaturaImpressao(
  dados: DadosFaturaImpressao,
  cfgLab: ConfigLaboratorio,
  cfgFaturas: ConfiguracoesFaturas,
  opcoes: OpcoesHtmlFaturaImpressao,
  money: (n: number) => string = (n) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
) {
  definirLocaleImpressao(
    resolverLocaleImpressao({ locale: opcoes.locale, configLab: cfgLab })
  );
  const dadosImpressao`
  );
}

const subs = [
  ['rotuloFinalizado = "Finalizado"', 'rotuloFinalizado = pl("print.fatura.finalizadoMeta")'],
  ['rotuloData = "Data"', 'rotuloData = pl("print.fatura.dataMeta")'],
  ['>Imprimir</button>', '>${pl("print.comum.imprimir")}</button>'],
  ['<span style="font-weight:bold">Fatura</span>', '<span style="font-weight:bold">${pl("print.fatura.titulo")}</span>'],
  ['>Fatura\n', '>${pl("print.fatura.titulo")}\n'],
  ['<strong>Cliente:</strong>', '<strong>${pl("print.fatura.cliente")}:</strong>'],
  ['<strong>Telefones:</strong>', '<strong>${pl("print.fatura.telefones")}:</strong>'],
  ['<strong>Último Pgto:</strong>', '<strong>${pl("print.fatura.ultimoPgto")}:</strong>'],
  ['<strong>Saldo Anterior:</strong>', '<strong>${pl("print.fatura.saldoAnterior")}:</strong>'],
  ['<strong>OS Externa:</strong>', '<strong>${pl("print.fatura.osExterna")}:</strong>'],
  ['<strong>Email:</strong>', '<strong>${pl("print.fatura.email")}:</strong>'],
  ['<strong>Endereço:</strong>', '<strong>${pl("print.fatura.endereco")}:</strong>'],
  ['linhaRotuloValor("Fatura:"', 'linhaRotuloValor(pl("print.fatura.titulo") + ":"'],
  ['linhaRotuloValor("Cliente:"', 'linhaRotuloValor(pl("print.fatura.cliente") + ":"'],
  ['linhaRotuloValor("Telefone:"', 'linhaRotuloValor(pl("print.fatura.telefone") + ":"'],
  ['linhaRotuloValor("OS Externa:"', 'linhaRotuloValor(pl("print.fatura.osExterna") + ":"'],
  ['linhaRotuloValor("Email:"', 'linhaRotuloValor(pl("print.fatura.email") + ":"'],
  ['linhaRotuloValor("Endereço:"', 'linhaRotuloValor(pl("print.fatura.endereco") + ":"'],
  ['linhaRotuloValor("Última Pgto:"', 'linhaRotuloValor(pl("print.fatura.ultimaPgto") + ":"'],
  ['linhaRotuloValor("Saldo Anterior:"', 'linhaRotuloValor(pl("print.fatura.saldoAnterior") + ":"'],
  ['linhaRotuloValor("Usuário:"', 'linhaRotuloValor(pl("print.fatura.usuario") + ":"'],
  ['<th>OS</th>', '<th>${pl("print.fatura.col.os")}</th>'],
  ['<th class="center">Qtd</th>', '<th class="center">${pl("print.fatura.col.qtd")}</th>'],
  ['<th>Serviços/Produtos</th>', '<th>${pl("print.fatura.col.servicos")}</th>'],
  ['<th>Num Dente</th>', '<th>${pl("print.fatura.col.numDente")}</th>'],
  ['<th>Paciente</th>', '<th>${pl("print.fatura.col.paciente")}</th>'],
  ['\'<th class="right">Unitário</th>\'', '\'<th class="right">${pl("print.fatura.col.unitario")}</th>\''],
  ['\'<th class="right">Desc</th>\'', '\'<th class="right">${pl("print.fatura.col.desconto")}</th>\''],
  ['\'<th class="right">Subtotal</th>\'', '\'<th class="right">${pl("print.fatura.col.subtotal")}</th>\''],
  ['<p style="font-weight:bold;margin:8px 0 6px">Condição de Pagamento</p>', '<p style="font-weight:bold;margin:8px 0 6px">${pl("print.fatura.condicaoPagamento")}</p>'],
  ['<th>Parcela</th>', '<th>${pl("print.fatura.col.parcela")}</th>'],
  ['<th>Vencimento</th>', '<th>${pl("print.fatura.col.vencimento")}</th>'],
  ['<th>Valor</th>', '<th>${pl("print.fatura.col.valor")}</th>'],
  ['<th>Pago</th>', '<th>${pl("print.fatura.col.pago")}</th>'],
  ['<strong>Observação:</strong>', '<strong>${pl("print.fatura.observacao")}:</strong>'],
  ['Observação: <strong>', '${pl("print.fatura.observacao")}: <strong>'],
  ['>Recebi o(s) serviço(s) descritos acima<', '>${pl("print.fatura.assinatura")}<'],
  ['>recebi o(s) serviço(s) descrito acima<', '>${pl("print.fatura.assinaturaMinusculo")}<'],
  ['>Pagar com PIX<', '>${pl("print.fatura.pagarPix")}<'],
  ['`Data: ${formatDate', '`${pl("print.fatura.dataMeta")}: ${formatDate'],
  ['`Usuário: ${escapeHtml', '`${pl("print.fatura.usuario")}: ${escapeHtml'],
  ['Data: ${escapeHtml(dataFatura)}', '${pl("print.fatura.data")}: ${escapeHtml(dataFatura)}'],
  ['Data: ${escapeHtml(dados.dataEmissao)}', '${pl("print.fatura.data")}: ${escapeHtml(dados.dataEmissao)}'],
  ['Usuário: ${escapeHtml(dados.usuario)}', '${pl("print.fatura.usuario")}: ${escapeHtml(dados.usuario)}'],
  ['return htmlMetaDatasFaturaLinha(linha, layout, "Finalizado")', 'return htmlMetaDatasFaturaLinha(linha, layout, pl("print.fatura.finalizadoMeta"))'],
  ['parcela: "Pagamento parcial"', 'parcela: pl("print.fatura.pagamentoParcial")'],
  ['<title>Fatura ${', '<title>${pl("print.fatura.titulo")} ${'],
];

for (const [from, to] of subs) {
  c = c.split(from).join(to);
}

fs.writeFileSync(file, c, "utf8");
console.log("fatura-impressao-html.ts atualizado");
