import type { LinhaComissaoColaborador } from "@/lib/comissoes-colaboradores";
import { formatarMoedaComissao } from "@/lib/comissoes-colaboradores";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import type { FiltroRelatorioComissaoColaboradores } from "@/lib/relatorio-comissao-colaboradores";

type ColunaPdf = {
  titulo: string;
  larguraMm: number;
  valor: (linha: LinhaComissaoColaborador) => string;
};

function montarColunas(filtro: Pick<
  FiltroRelatorioComissaoColaboradores,
  "mostrarPaciente" | "mostrarCliente" | "mostrarValorServico"
>): ColunaPdf[] {
  const colunas: ColunaPdf[] = [
    { titulo: "OS", larguraMm: 14, valor: (l) => String(l.numeroOs) },
    { titulo: "Data", larguraMm: 22, valor: (l) => l.dataLancamento },
    { titulo: "Colaborador", larguraMm: 36, valor: (l) => l.colaborador },
    { titulo: "Serviço", larguraMm: 40, valor: (l) => l.servico },
  ];
  if (filtro.mostrarPaciente) {
    colunas.push({ titulo: "Paciente", larguraMm: 32, valor: (l) => l.paciente });
  }
  if (filtro.mostrarCliente) {
    colunas.push({ titulo: "Cliente", larguraMm: 32, valor: (l) => l.cliente });
  }
  if (filtro.mostrarValorServico) {
    colunas.push({
      titulo: "Valor Serviço",
      larguraMm: 24,
      valor: (l) => formatarMoedaComissao(l.valorServico),
    });
  }
  colunas.push({
    titulo: "Comissão",
    larguraMm: 24,
    valor: (l) => formatarMoedaComissao(l.comissaoValor),
  });
  return colunas;
}

export async function gerarRelatorioComissaoColaboradoresModelo1Pdf(
  linhas: LinhaComissaoColaborador[],
  filtro: Pick<
    FiltroRelatorioComissaoColaboradores,
    "mostrarPaciente" | "mostrarCliente" | "mostrarValorServico"
  >
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  const margin = 14;
  const pageH = pdf.internal.pageSize.getHeight();
  const colunas = montarColunas(filtro);
  const tableW = colunas.reduce((s, c) => s + c.larguraMm, 0);
  const colX: number[] = [margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    colX.push(colX[i] + colunas[i].larguraMm);
  }
  const rowH = 6.5;
  const headerH = 7;
  let y = margin;

  y = desenharCabecalhoLabRelatorioPdf(api, margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Relatório Comissão Colaboradores", margin + tableW / 2, y, { align: "center" });
  y += 10;

  function desenharCabecalhoTabela() {
    pdf.setFillColor(238, 238, 238);
    pdf.rect(margin, y, tableW, headerH, "F");
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, tableW, headerH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    colunas.forEach((col, i) => {
      pdf.text(col.titulo, colX[i] + 2, y + headerH / 2 + 1.2);
    });
    y += headerH;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
  }

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
      desenharCabecalhoTabela();
    }
  }

  desenharCabecalhoTabela();

  const totalComissao = linhas.reduce((s, l) => s + l.comissaoValor, 0);

  if (linhas.length === 0) {
    novaPaginaSeNecessario(rowH);
    pdf.text("Nenhum registro encontrado para os filtros selecionados.", margin + 2, y + 4);
    y += rowH;
  } else {
    for (const linha of linhas) {
      novaPaginaSeNecessario(rowH);
      colunas.forEach((col, i) => {
        const texto = pdf.splitTextToSize(col.valor(linha), colunas[i].larguraMm - 4)[0] || "";
        pdf.text(texto, colX[i] + 2, y + rowH / 2 + 1.2);
      });
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, y + rowH, margin + tableW, y + rowH);
      y += rowH;
    }
  }

  novaPaginaSeNecessario(rowH + 2);
  y += 2;
  pdf.setFont("helvetica", "bold");
  const idxComissao = colunas.length - 1;
  pdf.text("Total", colX[Math.max(0, idxComissao - 1)] + 2, y + rowH / 2 + 1.2);
  pdf.text(
    formatarMoedaComissao(totalComissao),
    colX[idxComissao] + colunas[idxComissao].larguraMm - 2,
    y + rowH / 2 + 1.2,
    { align: "right" }
  );

  return pdf.output("blob");
}
