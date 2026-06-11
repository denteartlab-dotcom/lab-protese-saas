import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  LOGO_PDF_CABECALHO_OS_ALTURA_MM,
  LOGO_PDF_CABECALHO_OS_LARGURA_MM,
} from "@/lib/lab-impressao";
import type { GrupoOsPainelServicos } from "@/lib/painel-servicos-dashboard";

type GerarPdfServicosVencendoOpts = {
  lab: LabImpressaoConfig;
  grupos: GrupoOsPainelServicos[];
  tituloPeriodo: string;
};

const COLUNAS = [
  { chave: "os", titulo: "OS", largura: 12 },
  { chave: "cliente", titulo: "Cliente", largura: 28 },
  { chave: "servicos", titulo: "Serviços", largura: 38 },
  { chave: "paciente", titulo: "Paciente", largura: 28 },
  { chave: "situacao", titulo: "Situação", largura: 22 },
  { chave: "colaborador", titulo: "Colaborador", largura: 28 },
  { chave: "prazoLab", titulo: "Prazo Lab.", largura: 18 },
  { chave: "prazoDent", titulo: "Prazo Dent.", largura: 18 },
] as const;

function truncar(texto: string, max = 120) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1)}…`;
}

function linhaGrupoPdf(grupo: GrupoOsPainelServicos) {
  return {
    os: String(grupo.numeroOs),
    cliente: truncar(grupo.clienteNome, 40),
    servicos: truncar(grupo.servicos.join(", "), 70),
    paciente: truncar(grupo.pacienteNome, 40),
    situacao: truncar(grupo.situacao, 30),
    colaborador: truncar(grupo.colaborador, 40),
    prazoLab: grupo.prazoLab,
    prazoDent: grupo.prazoDent,
  };
}

export async function gerarPdfServicosVencendo({
  lab,
  grupos,
  tituloPeriodo,
}: GerarPdfServicosVencendoOpts): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;

  const logo = lab.logoDataUrl?.trim();

  if (logo?.startsWith("data:image")) {
    try {
      const formato = logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(
        logo,
        formato,
        margin,
        y,
        LOGO_PDF_CABECALHO_OS_LARGURA_MM,
        LOGO_PDF_CABECALHO_OS_ALTURA_MM
      );
    } catch {
      /* ignora logo inválido */
    }
  }

  const infoX = margin + LOGO_PDF_CABECALHO_OS_LARGURA_MM + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(lab.responsavel || lab.marca || "Laboratório", infoX, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(lab.endereco || lab.enderecoLinha1 || "", infoX, y + 10);
  doc.text(lab.telefones || "", infoX, y + 14);
  doc.text(lab.email || "", infoX, y + 18);

  y += LOGO_PDF_CABECALHO_OS_ALTURA_MM + 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Serviços vencendo até ${tituloPeriodo}`, pageW / 2, y, { align: "center" });
  y += 6;

  doc.line(margin, y, pageW - margin, y);
  y += 5;

  const larguraTotal = COLUNAS.reduce((s, c) => s + c.largura, 0);
  const escala = (pageW - margin * 2) / larguraTotal;
  let x = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  for (const col of COLUNAS) {
    const w = col.largura * escala;
    doc.text(col.titulo, x + 1, y);
    x += w;
  }
  y += 2;
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);

  const linhas = grupos.map(linhaGrupoPdf);
  const alturaLinha = 5;

  for (const linha of linhas) {
    if (y > doc.internal.pageSize.getHeight() - margin - alturaLinha) {
      doc.addPage();
      y = margin;
    }

    x = margin;
    for (const col of COLUNAS) {
      const w = col.largura * escala;
      const valor = linha[col.chave as keyof typeof linha] || "—";
      doc.text(String(valor), x + 1, y, { maxWidth: w - 2 });
      x += w;
    }
    y += alturaLinha;
  }

  return doc.output("blob");
}
