import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  desenharCabecalhoLabRelatorioPdf,
} from "@/lib/pdf-lab-cabecalho";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import {
  assinaturaReciboSemLinhaGuia,
  dadosRodapeAssinaturaRecibo,
  desenharRodapeAssinaturaReciboPdf,
} from "@/lib/recibo-assinatura-lab";
import { formatDate } from "@/lib/utils";
import {
  definirLocaleImpressao,
  formatMoneyImpressao,
  pl,
  resolverLocaleImpressao,
} from "@/lib/i18n/print-i18n";
import type { Locale } from "@/lib/i18n";
import { formatarQtdRecibo } from "@/lib/recibo-pacientes-fatura";
import {
  agregarPacientesDasLinhas,
  dataRecebimentoDasLinhas,
  textoFormaPagamentoRecibo,
  type LinhaReciboRecebimento,
  type ModeloReciboRecebimento,
} from "@/lib/recibo-recebimento";

function currencyBr(value: number) {
  return formatMoneyImpressao(value);
}

export async function gerarReciboRecebimentoPdf(
  modelo: ModeloReciboRecebimento,
  opts: {
    clienteNome: string;
    clienteEndereco?: string;
    clienteDocumento?: string;
    linhas: LinhaReciboRecebimento[];
    locale?: Locale;
  }
): Promise<Blob> {
  definirLocaleImpressao(resolverLocaleImpressao({ locale: opts.locale }));
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: pl("print.recibo.titulo") });
  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const total = opts.linhas.reduce((s, l) => s + l.valor, 0);
  const valorTotal = currencyBr(total);

  y = desenharCabecalhoLabRelatorioPdf(api, margin, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(pl("print.recibo.titulo"), pageW / 2, y, { align: "center" });
  y += 10;

  pdf.setFontSize(13);
  pdf.text(valorTotal, pageW - margin, y, { align: "right" });
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(pl("print.recibo.recebiDe"), margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(opts.clienteNome, margin + pdf.getTextWidth(pl("print.recibo.recebiDe") + " ") + 1, y);
  y += 6;

  const dadosCliente = [opts.clienteDocumento?.trim(), opts.clienteEndereco?.trim()].filter(
    Boolean
  ) as string[];
  if (dadosCliente.length > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(70, 70, 70);
    for (const linha of dadosCliente) {
      const partes = pdf.splitTextToSize(linha, pageW - margin * 2);
      pdf.text(partes, margin, y);
      y += partes.length * 4.2;
    }
    y += 3;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
  } else {
    y += 1;
  }

  pdf.setFont("helvetica", "normal");
  pdf.text(pl("print.recibo.quantia"), margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(valorTotal, margin + pdf.getTextWidth(pl("print.recibo.quantia") + " ") + 1, y);
  y += 10;

  if (modelo === "detalhado") {
    pdf.setFont("helvetica", "normal");
    pdf.text(pl("print.recibo.referente"), margin, y);
    y += 5;
    pdf.text(pl("print.recibo.cobrancasAbaixo"), margin, y);
    y += 8;

    const colW = [(pageW - margin * 2) * 0.55, (pageW - margin * 2) * 0.45];
    const colX = [margin, margin + colW[0]];

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(pl("print.recibo.formaPagamento"), colX[0] + colW[0] / 2, y, { align: "center" });
    pdf.text(pl("print.recibo.valor"), colX[1] + colW[1] / 2, y, { align: "center" });
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
      const descricao = `${formaComReferencia}\n${pl("print.recibo.faturaVencimento", { fatura: l.numeroFatura, vencimento })}`;
      const linhasDescricao = pdf.splitTextToSize(descricao, colW[0] - 4);
      const altura = Math.max(linhasDescricao.length * 4.5, 6);
      pdf.text(linhasDescricao, colX[0] + 2, y);
      pdf.text(valor, colX[1] + colW[1] - 2, y, { align: "right" });
      y += altura + 2;
    }
    y += 6;

    const pacientes = agregarPacientesDasLinhas(opts.linhas);
    if (pacientes.length > 0) {
      const util = pageW - margin * 2;
      const wPaciente = util * 0.32;
      const wServico = util * 0.38;
      const wQtd = util * 0.1;
      const wValor = util * 0.2;
      const xPaciente = margin;
      const xServico = xPaciente + wPaciente;
      const xQtd = xServico + wServico;
      const xValor = xQtd + wQtd;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(pl("print.recibo.pacientes"), margin, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.text(pl("print.os.paciente"), xPaciente + 2, y);
      pdf.text(pl("print.recibo.servico"), xServico + 2, y);
      pdf.text(pl("print.recibo.qtd"), xQtd + wQtd - 2, y, { align: "right" });
      pdf.text(pl("print.recibo.valor"), xValor + wValor - 2, y, { align: "right" });
      y += 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      for (const paciente of pacientes) {
        const nomeLinhas = pdf.splitTextToSize(paciente.nome, wPaciente - 4);
        const servicoLinhas = pdf.splitTextToSize(paciente.servico, wServico - 4);
        const altura = Math.max(servicoLinhas.length, nomeLinhas.length) * 4.5;
        pdf.text(nomeLinhas, xPaciente + 2, y);
        pdf.text(servicoLinhas, xServico + 2, y);
        pdf.text(formatarQtdRecibo(paciente.quantidade), xQtd + wQtd - 2, y, { align: "right" });
        pdf.text(currencyBr(paciente.valor), xValor + wValor - 2, y, { align: "right" });
        y += Math.max(altura, 6);
      }
      y += 1;
      pdf.setDrawColor(40, 40, 40);
      pdf.line(margin, y, pageW - margin, y);
      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.text(pl("print.recibo.total"), xPaciente + 2, y);
      pdf.text(valorTotal, xValor + wValor - 2, y, { align: "right" });
      y += 8;
    }
  } else {
    const referente =
      opts.linhas.length === 1
        ? pl("print.recibo.recebimentoFatura", { numero: opts.linhas[0].numeroFatura })
        : pl("print.recibo.recebimentoVarias", { qtd: opts.linhas.length });
    pdf.text(`${pl("print.recibo.referente")} ${referente}`, margin, y);
    y += 10;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(pl("print.recibo.firmo"), margin, y);
  y += 14;

  const labCfg = carregarConfigLaboratorio();
  const lab = labImpressaoFromConfig();
  const rodape = dadosRodapeAssinaturaRecibo(
    labCfg,
    lab,
    dataRecebimentoDasLinhas(opts.linhas)
  );
  if (rodape.assinaturaDataUrl) {
    rodape.assinaturaDataUrl = await assinaturaReciboSemLinhaGuia(
      rodape.assinaturaDataUrl
    );
  }

  desenharRodapeAssinaturaReciboPdf(pdf, pageW, margin, y, rodape);

  return pdf.output("blob");
}
