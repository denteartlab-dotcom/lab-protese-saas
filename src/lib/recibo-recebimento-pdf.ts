import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  desenharCabecalhoLabRelatorioPdf,
} from "@/lib/pdf-lab-cabecalho";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { formatDate } from "@/lib/utils";
import {
  textoFormaPagamentoRecibo,
  type LinhaReciboRecebimento,
  type ModeloReciboRecebimento,
} from "@/lib/recibo-recebimento";

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currencyBr(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function dataPorExtenso(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function gerarReciboRecebimentoPdf(
  modelo: ModeloReciboRecebimento,
  opts: {
    clienteNome: string;
    linhas: LinhaReciboRecebimento[];
  }
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: "Recibo" });
  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const total = opts.linhas.reduce((s, l) => s + l.valor, 0);
  const valorTotal = currencyBr(total);

  y = desenharCabecalhoLabRelatorioPdf(api, margin, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("RECIBO", pageW / 2, y, { align: "center" });
  y += 10;

  pdf.setFontSize(13);
  pdf.text(valorTotal, pageW - margin, y, { align: "right" });
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("Recebi de:", margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(opts.clienteNome, margin + pdf.getTextWidth("Recebi de: ") + 1, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.text("A quantia de:", margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(valorTotal, margin + pdf.getTextWidth("A quantia de: ") + 1, y);
  y += 10;

  if (modelo === "detalhado") {
    pdf.setFont("helvetica", "normal");
    pdf.text("Referente a:", margin, y);
    y += 5;
    pdf.text("Recebimento das cobranças descritas abaixo:", margin, y);
    y += 8;

    const colW = [(pageW - margin * 2) * 0.55, (pageW - margin * 2) * 0.45];
    const colX = [margin, margin + colW[0]];

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Forma Pagamento", colX[0] + colW[0] / 2, y, { align: "center" });
    pdf.text("Valor", colX[1] + colW[1] / 2, y, { align: "center" });
    y += 3;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageW - margin, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    for (const l of opts.linhas) {
      const formaComReferencia = textoFormaPagamentoRecibo(l);
      const valor = currencyBr(l.valor);
      const vencimento = formatDate(l.data);
      const descricao = `${formaComReferencia}\nFatura: ${l.numeroFatura} | Vencimento: ${vencimento}`;
      const linhasDescricao = pdf.splitTextToSize(descricao, colW[0] - 4);
      const altura = Math.max(linhasDescricao.length * 4.5, 6);
      pdf.text(linhasDescricao, colX[0] + 2, y);
      pdf.text(valor, colX[1] + colW[1] - 2, y, { align: "right" });
      y += altura + 2;
    }
    y += 4;
  } else {
    const referente =
      opts.linhas.length === 1
        ? `Recebimento da fatura nº ${opts.linhas[0].numeroFatura}.`
        : `Recebimento de ${opts.linhas.length} cobranças.`;
    pdf.text(`Referente a: ${referente}`, margin, y);
    y += 10;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("e para clareza firmo o presente.", margin, y);
  y += 14;

  const labCfg = carregarConfigLaboratorio();
  const lab = labImpressaoFromConfig();
  const cidade =
    labCfg.cidade?.trim() ||
    lab.endereco?.split(",")[0]?.trim() ||
    "Governador Valadares";

  pdf.text(`${cidade}, ${dataPorExtenso(new Date())}.`, pageW - margin, y, {
    align: "right",
  });
  y += 20;

  const responsavel = lab.responsavel?.trim() || "";
  const cnpj = labCfg.cnpj?.trim() ? `CNPJ: ${labCfg.cnpj.trim()}` : "";
  const assinaturaW = 80;
  const assinaturaX = (pageW - assinaturaW) / 2;
  pdf.setDrawColor(80, 80, 80);
  pdf.line(assinaturaX, y, assinaturaX + assinaturaW, y);
  y += 5;
  pdf.text(responsavel, pageW / 2, y, { align: "center" });
  if (cnpj) {
    y += 8;
    pdf.text(cnpj, pageW / 2, y, { align: "center" });
  }

  return pdf.output("blob");
}
