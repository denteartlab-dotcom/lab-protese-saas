import type { LinhaExtratoIndividualComSaldo } from "@/lib/extrato-individual-dados";

export type LinhaExtratoClienteExport = {
  data: string;
  fatura: string;
  os: string;
  descricao: string;
  qtd: string;
  paciente: string;
  numDente: string;
  valor: number;
  saldo: number;
};

const COLUNAS_EXCEL = [
  { titulo: "DATA", largura: 72 },
  { titulo: "FATURA", largura: 48 },
  { titulo: "OS", largura: 40 },
  { titulo: "DESCRIÇÃO", largura: 180 },
  { titulo: "QTD", largura: 36 },
  { titulo: "PACIENTE", largura: 120 },
  { titulo: "NUM DEN", largura: 56 },
  { titulo: "VALOR", largura: 72 },
  { titulo: "SALDO", largura: 72 },
] as const;

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

function celulaNumero(valor: number, styleId = "Numero") {
  const n = Number.isFinite(valor) ? valor : 0;
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${n.toFixed(2)}</Data></Cell>`;
}

export function linhasExtratoClienteParaExport(
  linhas: LinhaExtratoIndividualComSaldo[],
  descricao: (linha: LinhaExtratoIndividualComSaldo) => string
): LinhaExtratoClienteExport[] {
  return linhas.map((linha) => {
    const pagamento = linha.tipo === "pagamento" || linha.tipo === "desconto";
    const credito = linha.tipo === "credito";
    const valor = credito
      ? Math.abs(linha.valorUn)
      : pagamento
        ? -Math.abs(linha.subtotal)
        : linha.subtotal;
    return {
      data: linha.dataFatura,
      fatura: linha.numFatura,
      os: linha.os,
      descricao: descricao(linha),
      qtd: linha.qtd,
      paciente: linha.paciente,
      numDente: linha.numDente,
      valor,
      saldo: linha.saldo,
    };
  });
}

function montarXmlExtratoCliente(linhas: LinhaExtratoClienteExport[]) {
  const colunasXml = COLUNAS_EXCEL.map(
    (col) => `<Column ss:Width="${col.largura}"/>`
  ).join("");

  const headerXml = `<Row>${COLUNAS_EXCEL.map((col) => celulaTexto(col.titulo, "Cabecalho")).join("")}</Row>`;

  const linhasXml = linhas
    .map(
      (linha) =>
        `<Row>${[
          celulaTexto(linha.data),
          celulaTexto(linha.fatura),
          celulaTexto(linha.os),
          celulaTexto(linha.descricao),
          celulaTexto(linha.qtd),
          celulaTexto(linha.paciente),
          celulaTexto(linha.numDente),
          celulaNumero(linha.valor),
          celulaNumero(linha.saldo),
        ].join("")}</Row>`
    )
    .join("");

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
  <Style ss:ID="Numero">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Extrato">
  <Table>
   ${colunasXml}
   ${headerXml}
   ${linhasXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function exportarExtratoClienteExcel(linhas: LinhaExtratoClienteExport[]) {
  const conteudo = montarXmlExtratoCliente(linhas);
  const blob = new Blob([conteudo], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "extrato-cliente.xls";
  link.click();
  URL.revokeObjectURL(url);
}
