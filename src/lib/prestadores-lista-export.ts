import { baixarExcel } from "@/lib/exportar-excel";

export type PrestadorListagemExport = {
  id?: string;
  nome: string;
  tipoServico: string;
  cpf: string;
  cnpj: string;
  email: string;
  telefoneResidencial: string;
  telefoneComercial: string;
  celular: string;
  whatsapp: string;
  valorComissao: string;
  descontoComissao: string;
  valorComissaoRepeticao: string;
  cep: string;
  rua: string;
  numero: string;
  cidade: string;
  uf: string;
  bairro: string;
  complemento: string;
};

const COLUNAS_EXPORT = [
  "Nome",
  "Tipo de Serviço",
  "Celular",
  "WhatsApp",
  "E-mail",
  "CPF",
  "CNPJ",
  "Tel. Residencial",
  "Tel. Comercial",
  "Comissão",
  "Desconto Comissão",
  "Comissão Repetição",
  "CEP",
  "Rua",
  "Número",
  "Bairro",
  "Cidade",
  "UF",
  "Complemento",
] as const;

const COLUNAS_PDF = [
  { titulo: "Nome", larguraMm: 42 },
  { titulo: "Tipo de Serviço", larguraMm: 38 },
  { titulo: "Celular", larguraMm: 28 },
  { titulo: "WhatsApp", larguraMm: 28 },
  { titulo: "E-mail", larguraMm: 54 },
] as const;

function texto(valor?: string | null) {
  return (valor ?? "").trim();
}

function linhaExportPrestador(p: PrestadorListagemExport) {
  return [
    p.nome,
    p.tipoServico || "",
    p.celular || "",
    p.whatsapp || "",
    p.email || "",
    p.cpf || "",
    p.cnpj || "",
    p.telefoneResidencial || "",
    p.telefoneComercial || "",
    p.valorComissao || "",
    p.descontoComissao || "",
    p.valorComissaoRepeticao || "",
    p.cep || "",
    p.rua || "",
    p.numero || "",
    p.bairro || "",
    p.cidade || "",
    p.uf || "",
    p.complemento || "",
  ];
}

export async function exportarPrestadoresExcel(prestadores: PrestadorListagemExport[]) {
  const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  await baixarExcel(
    `prestadores-${data}`,
    [...COLUNAS_EXPORT],
    prestadores.map(linhaExportPrestador),
    {
      nomeAba: "Prestadores",
      colunasTexto: [2, 3, 6, 7, 12],
    }
  );
}

export async function gerarListaPrestadoresPdf(
  prestadores: PrestadorListagemExport[]
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
  pdf.text("Lista de Prestadores de Serviço Cadastrados", 105, y + 4, { align: "center" });
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

  for (const prestador of prestadores) {
    novaPaginaSeNecessario(rowH);
    const valores = [
      prestador.nome,
      texto(prestador.tipoServico),
      texto(prestador.celular),
      texto(prestador.whatsapp),
      texto(prestador.email),
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
