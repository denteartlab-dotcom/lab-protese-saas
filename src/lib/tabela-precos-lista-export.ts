import {
  cabecalhoRelatorioLaboratorio,
  carregarConfigLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";
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

function cabecalhoPdfTabela(tabela: string) {
  if (typeof window === "undefined") {
    return { nome: tabela, telefone: "", email: "" };
  }
  const cab = cabecalhoRelatorioLaboratorio();
  const cfg = carregarConfigLaboratorio();
  const telefone =
    telefoneWhatsappLaboratorio(cfg) ||
    cfg.telefoneComercial?.trim() ||
    cfg.celular?.trim() ||
    cab.telefones;
  return {
    nome: cab.nome || tabela,
    telefone,
    email: cab.email,
  };
}

export async function gerarPdfTabelaPrecos(
  tabela: string,
  categorias: CategoriaTabelaPrecoExport[]
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const centerX = pageW / 2;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 20;

  const cab = cabecalhoPdfTabela(tabela);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(cab.nome, centerX, y, { align: "center" });
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  if (cab.telefone) {
    pdf.text(cab.telefone, centerX, y, { align: "center" });
    y += 5;
  }
  if (cab.email) {
    pdf.text(cab.email, centerX, y, { align: "center" });
    y += 5;
  }

  y += 3;
  pdf.setDrawColor(190, 190, 190);
  pdf.line(margin, y, pageW - margin, y);
  y += 10;

  const rowH = 7;
  const gapCategoria = 8;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  for (const categoria of categorias) {
    const itens = categoria.servicos.filter((servico) => !servico.oculto);
    if (itens.length === 0) continue;

    novaPaginaSeNecessario(14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(categoria.nome, centerX, y, { align: "center" });
    y += gapCategoria;

    for (const servico of itens) {
      novaPaginaSeNecessario(rowH + 2);
      pdf.setFillColor(248, 248, 248);
      pdf.setDrawColor(225, 225, 225);
      pdf.rect(margin, y - 5, contentW, rowH, "FD");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const nomeLinha =
        pdf.splitTextToSize(servico.nome, contentW - 40)[0] || servico.nome;
      pdf.text(nomeLinha, margin + 3, y);
      pdf.text(money(servico.valor), pageW - margin - 3, y, { align: "right" });
      y += rowH + 1.5;
    }

    y += 4;
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
