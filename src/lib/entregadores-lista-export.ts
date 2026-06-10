import type { EntregadorCadastro } from "@/lib/entregadores-cadastro";
import { baixarExcel } from "@/lib/exportar-excel";

export type EntregadorListagemExport = EntregadorCadastro;

const COLUNAS_EXPORT = [
  "Nome",
  "Tipo de Entregador",
  "Celular",
  "WhatsApp",
  "E-mail",
  "CPF",
  "CNPJ",
  "Tel. Residencial",
  "Tel. Comercial",
  "CEP",
  "Rua",
  "Número",
  "Bairro",
  "Cidade",
  "UF",
  "Complemento",
] as const;

const COLUNAS_PDF = [
  { titulo: "Nome", larguraMm: 48 },
  { titulo: "Celular", larguraMm: 32 },
  { titulo: "WhatsApp", larguraMm: 32 },
  { titulo: "E-mail", larguraMm: 68 },
] as const;

function texto(valor?: string | null) {
  return (valor ?? "").trim();
}

function linhaExportEntregador(e: EntregadorListagemExport) {
  return [
    e.nome,
    e.tipoEntregador || "",
    e.celular || "",
    e.whatsapp || "",
    e.email || "",
    e.cpf || "",
    e.cnpj || "",
    e.telefoneResidencial || "",
    e.telefoneComercial || "",
    e.cep || "",
    e.rua || "",
    e.numero || "",
    e.bairro || "",
    e.cidade || "",
    e.uf || "",
    e.complemento || "",
  ];
}

export async function exportarEntregadoresExcel(entregadores: EntregadorListagemExport[]) {
  const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  await baixarExcel(
    `entregadores-${data}`,
    [...COLUNAS_EXPORT],
    entregadores.map(linhaExportEntregador),
    {
      nomeAba: "Entregadores",
      colunasTexto: [2, 3, 5, 6, 9],
    }
  );
}

export async function gerarListaEntregadoresPdf(
  entregadores: EntregadorListagemExport[]
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 10;
  const pageH = pdf.internal.pageSize.getHeight();
  const rowH = 6.5;
  const headerH = 7;
  const colX: number[] = [margin];
  for (let i = 0; i < COLUNAS_PDF.length - 1; i++) {
    colX.push(colX[i] + COLUNAS_PDF[i].larguraMm);
  }

  let y = margin;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Lista de Entregadores Cadastrados", 105, y + 4, { align: "center" });
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(hoje, 105, y, { align: "center" });
  y += 8;

  novaPaginaSeNecessario(headerH);
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(
    margin,
    y,
    colX[colX.length - 1] + COLUNAS_PDF[COLUNAS_PDF.length - 1].larguraMm - margin,
    headerH,
    "FD"
  );
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  COLUNAS_PDF.forEach((col, i) => {
    pdf.text(col.titulo, colX[i] + 1.5, y + 4.5);
  });
  y += headerH;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);

  for (const entregador of entregadores) {
    novaPaginaSeNecessario(rowH);
    const valores = [
      entregador.nome,
      texto(entregador.celular),
      texto(entregador.whatsapp),
      texto(entregador.email),
    ];
    pdf.setDrawColor(241, 245, 249);
    pdf.line(margin, y + rowH, margin + 190, y + rowH);
    valores.forEach((valor, i) => {
      const textoCelula = pdf.splitTextToSize(valor, COLUNAS_PDF[i].larguraMm - 3)[0] || "";
      pdf.text(textoCelula, colX[i] + 1.5, y + 4.2);
    });
    y += rowH;
  }

  return pdf.output("blob");
}
