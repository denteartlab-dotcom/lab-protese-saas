#!/usr/bin/env node
/** Aplica pl() no recibo PDF. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/lib/recibo-recebimento-pdf.ts");
let c = fs.readFileSync(file, "utf8");

if (!c.includes("definirLocaleImpressao")) {
  c = c.replace(
    'import { formatDate } from "@/lib/utils";',
    `import { formatDate } from "@/lib/utils";
import {
  definirLocaleImpressao,
  formatMoneyImpressao,
  pl,
  resolverLocaleImpressao,
} from "@/lib/i18n/print-i18n";
import type { Locale } from "@/lib/i18n";`
  );

  c = c.replace(
    `export async function gerarReciboRecebimentoPdf(
  modelo: ModeloReciboRecebimento,
  opts: {
    clienteNome: string;
    linhas: LinhaReciboRecebimento[];
  }
): Promise<Blob> {`,
    `export async function gerarReciboRecebimentoPdf(
  modelo: ModeloReciboRecebimento,
  opts: {
    clienteNome: string;
    linhas: LinhaReciboRecebimento[];
    locale?: Locale;
  }
): Promise<Blob> {
  definirLocaleImpressao(resolverLocaleImpressao({ locale: opts.locale }));`
  );

  c = c.replace(
    'pdf.setProperties({ title: "Recibo" });',
    'pdf.setProperties({ title: pl("print.recibo.titulo") });'
  );
}

const subs = [
  ['pdf.text("RECIBO",', 'pdf.text(pl("print.recibo.titulo"),'],
  ['pdf.text("Recebi de:",', 'pdf.text(pl("print.recibo.recebiDe"),'],
  ['pdf.getTextWidth("Recebi de: ")', 'pdf.getTextWidth(pl("print.recibo.recebiDe") + " ")'],
  ['pdf.text("A quantia de:",', 'pdf.text(pl("print.recibo.quantia"),'],
  ['pdf.getTextWidth("A quantia de: ")', 'pdf.getTextWidth(pl("print.recibo.quantia") + " ")'],
  ['pdf.text("Referente a:",', 'pdf.text(pl("print.recibo.referente"),'],
  ['pdf.text("Recebimento das cobranças descritas abaixo:",', 'pdf.text(pl("print.recibo.cobrancasAbaixo"),'],
  ['pdf.text("Forma Pagamento",', 'pdf.text(pl("print.recibo.formaPagamento"),'],
  ['pdf.text("Valor",', 'pdf.text(pl("print.recibo.valor"),'],
  ['pdf.text("e para clareza firmo o presente.",', 'pdf.text(pl("print.recibo.firmo"),'],
  ['`Recebimento da fatura nº ${opts.linhas[0].numeroFatura}.`', 'pl("print.recibo.recebimentoFatura", { numero: opts.linhas[0].numeroFatura })'],
  ['`Recebimento de ${opts.linhas.length} cobranças.`', 'pl("print.recibo.recebimentoVarias", { qtd: opts.linhas.length })'],
  ['`Referente a: ${referente}`', '`${pl("print.recibo.referente")} ${referente}`'],
  ['`\\nFatura: ${l.numeroFatura} | Vencimento: ${vencimento}`', '`\\n${pl("print.recibo.faturaVencimento", { fatura: String(l.numeroFatura), vencimento })}`'],
];

for (const [from, to] of subs) {
  c = c.split(from).join(to);
}

fs.writeFileSync(file, c, "utf8");
console.log("recibo-recebimento-pdf.ts atualizado");
