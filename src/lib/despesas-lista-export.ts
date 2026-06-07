import type { DespesaDescompactada } from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";

export type LinhaListaDespesa = {
  vencimento: string;
  parcela: string;
  nome: string;
  referencia: string;
  categoria: string;
  forma: string;
  situacao: string;
  valor: number;
};

type LancamentoListaDespesa = {
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { nome?: string } | null;
};

type ItemListaDespesaFiltrada = {
  lancamento: LancamentoListaDespesa;
  pack: DespesaDescompactada;
  ref: string;
};

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelParcela(pack: DespesaDescompactada) {
  const noTexto = pack.texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (noTexto) return `${noTexto[1]} / ${noTexto[2]}`;
  const total = Number.parseInt(pack.parcela, 10);
  if (Number.isFinite(total) && total > 1) return `1 / ${total}`;
  return pack.parcela || "1";
}

function labelSituacao(status: string) {
  if (status === "pago") return "pago";
  return "a pagar";
}

function labelForma(forma?: string | null) {
  const valor = forma?.trim();
  return valor ? valor.toLowerCase() : "";
}

export function linhasListaDespesaFromFiltradas(
  linhas: ItemListaDespesaFiltrada[]
): LinhaListaDespesa[] {
  return linhas.map(({ lancamento, pack, ref }) => ({
    vencimento: formatDate(lancamento.data),
    parcela: labelParcela(pack),
    nome: lancamento.cliente?.nome || pack.nome || "—",
    referencia: ref?.trim() || "",
    categoria: pack.categoria || "—",
    forma: labelForma(lancamento.formaPagamento),
    situacao: labelSituacao(lancamento.status),
    valor: lancamento.valor,
  }));
}

const COLUNAS_PDF = [
  { titulo: "Vencimento", larguraMm: 22, align: "left" as const },
  { titulo: "Parcela", larguraMm: 16, align: "left" as const },
  { titulo: "Nome", larguraMm: 38, align: "left" as const },
  { titulo: "Referência", larguraMm: 18, align: "left" as const },
  { titulo: "Categoria", larguraMm: 32, align: "left" as const },
  { titulo: "Forma", larguraMm: 18, align: "left" as const },
  { titulo: "situacao", larguraMm: 18, align: "left" as const },
  { titulo: "Valor", larguraMm: 20, align: "right" as const },
];

const INDICE_COLUNA_SITUACAO = 6;
const INDICE_COLUNA_VALOR = 7;

export async function gerarPdfListaDespesas(linhas: LinhaListaDespesa[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 10;
  const pageH = pdf.internal.pageSize.getHeight();
  const tableW = COLUNAS_PDF.reduce((s, c) => s + c.larguraMm, 0);
  const colX: number[] = [margin];
  for (let i = 0; i < COLUNAS_PDF.length - 1; i++) {
    colX.push(colX[i] + COLUNAS_PDF[i].larguraMm);
  }
  const rowH = 6.5;
  const headerH = 7;
  let y = margin;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
      desenharCabecalho();
    }
  }

  function textoCelula(
    texto: string,
    colIndex: number,
    align: "left" | "center" | "right",
    bold = false
  ) {
    const col = COLUNAS_PDF[colIndex];
    const x = colX[colIndex];
    const w = col.larguraMm;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(9);
    const pad = 1.5;
    const truncado = pdf.splitTextToSize(texto, w - pad * 2)[0] || texto;
    const tx =
      align === "right"
        ? x + w - pad
        : align === "center"
          ? x + w / 2
          : x + pad;
    pdf.text(truncado, tx, y + rowH / 2 + 1.2, { align });
  }

  function desenharCabecalho() {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    COLUNAS_PDF.forEach((col, i) => {
      textoCelula(col.titulo, i, col.align, true);
    });
    y += headerH;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, margin + tableW, y);
  }

  desenharCabecalho();

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);

  if (linhas.length === 0) {
    novaPaginaSeNecessario(rowH);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Nenhuma despesa encontrada.", margin, y + 4);
    y += rowH;
  } else {
    for (const linha of linhas) {
      novaPaginaSeNecessario(rowH);
      const valores = [
        linha.vencimento,
        linha.parcela,
        linha.nome,
        linha.referencia,
        linha.categoria,
        linha.forma,
        linha.situacao,
        moneyBr(linha.valor),
      ];
      valores.forEach((texto, i) => {
        textoCelula(texto, i, COLUNAS_PDF[i].align);
      });
      y += rowH;
    }
  }

  novaPaginaSeNecessario(rowH + 2);
  y += 2;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, margin + tableW, y);
  y += 1;
  textoCelula("Total", INDICE_COLUNA_SITUACAO, "left", true);
  textoCelula(moneyBr(totalValor), INDICE_COLUNA_VALOR, "right", true);
  y += rowH;

  return pdf.output("blob");
}

function escXml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function celulaTexto(valor: string, styleId = "Texto") {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escXml(valor)}</Data></Cell>`;
}

function celulaMoeda(valor: number) {
  return `<Cell ss:StyleID="Moeda"><Data ss:Type="Number">${valor.toFixed(2)}</Data></Cell>`;
}

const COLUNAS_EXCEL = [
  { titulo: "Vencimento", largura: 72 },
  { titulo: "Parcela", largura: 48 },
  { titulo: "Nome", largura: 140 },
  { titulo: "Referência", largura: 72 },
  { titulo: "Categoria", largura: 120 },
  { titulo: "Forma", largura: 72 },
  { titulo: "situacao", largura: 72 },
  { titulo: "Valor", largura: 64 },
] as const;

function montarXmlListaDespesas(linhas: LinhaListaDespesa[]) {
  const colunasXml = COLUNAS_EXCEL.map(
    (col) => `<Column ss:Width="${col.largura}"/>`
  ).join("");

  const headerXml = `<Row>${COLUNAS_EXCEL.map((col) => celulaTexto(col.titulo, "Cabecalho")).join("")}</Row>`;

  const linhasXml = linhas
    .map(
      (linha) =>
        `<Row>${[
          celulaTexto(linha.vencimento),
          celulaTexto(linha.parcela),
          celulaTexto(linha.nome),
          celulaTexto(linha.referencia),
          celulaTexto(linha.categoria),
          celulaTexto(linha.forma),
          celulaTexto(linha.situacao),
          celulaMoeda(linha.valor),
        ].join("")}</Row>`
    )
    .join("");

  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const totalXml = `<Row>${[
    celulaTexto(""),
    celulaTexto(""),
    celulaTexto(""),
    celulaTexto(""),
    celulaTexto(""),
    celulaTexto(""),
    celulaTexto("Total", "Cabecalho"),
    celulaMoeda(total),
  ].join("")}</Row>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Cabecalho">
   <Font ss:Bold="1"/>
  </Style>
  <Style ss:ID="Texto">
   <NumberFormat ss:Format="@"/>
  </Style>
  <Style ss:ID="Moeda">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Despesas">
  <Table>
   ${colunasXml}
   ${headerXml}
   ${linhasXml}
   ${totalXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function exportarListaDespesasExcel(linhas: LinhaListaDespesa[]) {
  const conteudo = montarXmlListaDespesas(linhas);
  const blob = new Blob([conteudo], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "despesas.xls";
  link.click();
  URL.revokeObjectURL(url);
}
