import { baixarExcel } from "@/lib/exportar-excel";

export type ItemTabelaPrecoExport = {
  nome: string;
  valor: number;
  tipo?: string;
  prazo?: string;
  prazoDentista?: string;
  descontoRepeticao?: number;
  oculto?: boolean;
};

export type CategoriaTabelaPrecoExport = {
  nome: string;
  servicos: ItemTabelaPrecoExport[];
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelTipo(tipo?: string) {
  if (tipo === "produto") return "Produto";
  if (tipo === "transporte") return "Transporte";
  return "Serviço";
}

function linhasPlanilha(tabela: string, categorias: CategoriaTabelaPrecoExport[]) {
  const linhas: (string | number)[][] = [];
  for (const categoria of categorias) {
    for (const servico of categoria.servicos) {
      linhas.push([
        tabela,
        categoria.nome,
        servico.nome,
        labelTipo(servico.tipo),
        money(servico.valor),
        servico.prazo || "",
        servico.prazoDentista || "",
        servico.descontoRepeticao != null ? money(servico.descontoRepeticao) : "",
        servico.oculto ? "Sim" : "Não",
      ]);
    }
  }
  return linhas;
}

export async function exportarTabelaPrecosExcel(
  tabela: string,
  categorias: CategoriaTabelaPrecoExport[]
) {
  const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const slug = tabela.replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "tabela";
  await baixarExcel(
    `tabela-precos-${slug}-${data}`,
    [
      "Tabela",
      "Categoria",
      "Nome",
      "Tipo",
      "Valor",
      "Prazo",
      "Prazo Dentista",
      "Desconto Repetição",
      "Oculto",
    ],
    linhasPlanilha(tabela, categorias),
    {
      nomeAba: "Tabela de Preços",
      colunasTexto: [4, 7],
    }
  );
}

const COLUNAS_PDF = [
  { titulo: "Categoria", larguraMm: 42 },
  { titulo: "Nome", larguraMm: 72 },
  { titulo: "Valor", larguraMm: 28 },
] as const;

export async function gerarPdfTabelaPrecos(
  tabela: string,
  categorias: CategoriaTabelaPrecoExport[]
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
  pdf.text(`Tabela de Preços — ${tabela}`, 105, y + 4, { align: "center" });
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

  for (const categoria of categorias) {
    for (const servico of categoria.servicos) {
      if (servico.oculto) continue;
      novaPaginaSeNecessario(rowH);
      const valores = [categoria.nome, servico.nome, money(servico.valor)];
      pdf.setDrawColor(241, 245, 249);
      pdf.line(margin, y + rowH, margin + 142, y + rowH);
      valores.forEach((valor, i) => {
        const textoCelula = pdf.splitTextToSize(valor, COLUNAS_PDF[i].larguraMm - 3)[0] || "";
        pdf.text(textoCelula, colX[i] + 1.5, y + 4.2);
      });
      y += rowH;
    }
  }

  return pdf.output("blob");
}

export function textoEmailTabelaPrecos(
  tabela: string,
  categorias: CategoriaTabelaPrecoExport[]
) {
  const linhas: string[] = [`Tabela de Preços: ${tabela}`, ""];
  for (const categoria of categorias) {
    linhas.push(categoria.nome);
    for (const servico of categoria.servicos) {
      if (servico.oculto) continue;
      linhas.push(`  • ${servico.nome} — R$ ${money(servico.valor)}`);
    }
    linhas.push("");
  }
  return linhas.join("\n");
}

export function baixarPdfTabelaPrecos(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
