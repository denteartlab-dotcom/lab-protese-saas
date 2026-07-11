#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/app/trabalhos/[id]/imprimir/pdf-os-viewer.tsx"
);
let c = fs.readFileSync(file, "utf8");

if (!c.includes("print-relatorio-helpers")) {
  c = c.replace(
    'import { compactarDentesParaImpressaoOs } from "@/lib/dentes-os-resumo";',
    `import { compactarDentesParaImpressaoOs } from "@/lib/dentes-os-resumo";
import { iniciarImpressaoRelatorio, pl } from "@/lib/i18n/print-relatorio-helpers";`
  );
}

if (!c.includes("iniciarImpressaoRelatorio()")) {
  c = c.replace(
    "async function buildPdf() {\n      setErroPdf(\"\");",
    "async function buildPdf() {\n      iniciarImpressaoRelatorio();\n      setErroPdf(\"\");"
  );
}

const subs = [
  ['pdf.text("Prazo: "', 'pdf.text(`${pl("print.os.prazo")}: `'],
  ['pdf.getTextWidth("Prazo: ")', 'pdf.getTextWidth(`${pl("print.os.prazo")}: `'],
  ['pdf.text("Finalizado: "', 'pdf.text(`${pl("print.os.finalizado")}: `'],
  ['pdf.getTextWidth("Finalizado: ")', 'pdf.getTextWidth(`${pl("print.os.finalizado")}: `'],
  ['"Colaborador: "', '`${pl("print.os.colaborador")}: `'],
  ['"Colaborador:",', '`${pl("print.os.colaborador")}:`,'],
  ['"Prazo:",', '`${pl("print.os.prazo")}:`,'],
  [': "Etapas:"', ': `${pl("print.os.etapas")}:`'],
  [' — Etapas:`', ' — ${pl("print.os.etapas")}:`'],
  ['marcas.push("URGENTE")', 'marcas.push(pl("print.os.urgente"))'],
  ['marcas.push("REPETIÇÃO")', 'marcas.push(pl("print.os.repeticao"))'],
  [': "Assinatura"', ': pl("print.os.assinatura")'],
  [">Baixar<", ">{pl(\"print.comum.baixar\")}<"],
  [">Imprimir<", ">{pl(\"print.comum.imprimir\")}<"],
  [">Nova aba<", ">{pl(\"print.comum.novaAba\")}<"],
  [">Tentar novamente<", ">{pl(\"print.comum.tentarNovamente\")}<"],
  ["Gerando PDF da OS...", "{pl(\"print.comum.gerandoPdfOs\")}"],
];

for (const [from, to] of subs) {
  c = c.replaceAll(from, to);
}

fs.writeFileSync(file, c);
console.log("pdf-os-viewer i18n applied");
