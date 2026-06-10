import {
  cabecalhoRelatorioLaboratorio,
  carregarConfigLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";
import { baixarExcel } from "@/lib/exportar-excel";
import {
  alinhamentoPdfImpressao,
  configPadraoImpressaoTabelaPrecos,
  fontePdfImpressao,
  hexParaRgb,
  pxParaMm,
  type ConfigImpressaoTabelaPrecos,
} from "@/lib/tabela-precos-impressao-config";

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
  categorias: CategoriaTabelaPrecoExport[],
  config?: ConfigImpressaoTabelaPrecos | null
): Promise<Blob> {
  const cfg = config ?? configPadraoImpressaoTabelaPrecos(tabela);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const centerX = pageW / 2;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 20;

  const fontePdf = fontePdfImpressao(cfg.tipoFonte);
  const tamanhoCategoria = cfg.tamanhoFonte * 0.75;
  const tamanhoServico = Math.max(6, (cfg.tamanhoFonte - 2) * 0.75);
  const rowH = Math.max(6, pxParaMm(cfg.espacamentoServicos));
  const gapCategoria = pxParaMm(cfg.espacamentoCategorias);
  const [rCat, gCat, bCat] = hexParaRgb(cfg.corCategorias);
  const [rSrv, gSrv, bSrv] = hexParaRgb(cfg.corServicos);
  const [rBord, gBord, bBord] = hexParaRgb(cfg.corBordas);
  const alinhamento = alinhamentoPdfImpressao(cfg.alinhamentoCategoria);

  function xCategoria() {
    if (alinhamento === "left") return margin;
    if (alinhamento === "right") return pageW - margin;
    return centerX;
  }

  const cab = cabecalhoPdfTabela(tabela);

  if (cfg.mostrarCabecalho) {
    pdf.setFont(fontePdf, "bold");
    pdf.setFontSize(tamanhoCategoria);
    pdf.setTextColor(0, 0, 0);
    pdf.text(cab.nome, centerX, y, { align: "center" });
    y += 7;

    pdf.setFont(fontePdf, "normal");
    pdf.setFontSize(tamanhoServico);
    if (cab.telefone) {
      pdf.text(cab.telefone, centerX, y, { align: "center" });
      y += 5;
    }
    if (cab.email) {
      pdf.text(cab.email, centerX, y, { align: "center" });
      y += 5;
    }

    y += 3;
    pdf.setDrawColor(rBord, gBord, bBord);
    pdf.line(margin, y, pageW - margin, y);
    y += 8;
  }

  if (cfg.titulo.trim()) {
    pdf.setFont(fontePdf, "normal");
    pdf.setFontSize(tamanhoCategoria);
    pdf.setTextColor(rCat, gCat, bCat);
    pdf.text(cfg.titulo.trim().toUpperCase(), centerX, y, { align: "center" });
    y += gapCategoria + 2;
  }

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  for (const categoria of categorias) {
    const itens = categoria.servicos.filter((servico) => !servico.oculto);
    if (itens.length === 0) continue;

    novaPaginaSeNecessario(gapCategoria + rowH);
    pdf.setFont(fontePdf, "normal");
    pdf.setFontSize(tamanhoCategoria);
    pdf.setTextColor(rCat, gCat, bCat);
    pdf.text(categoria.nome, xCategoria(), y, { align: alinhamento });
    y += gapCategoria;

    for (const servico of itens) {
      novaPaginaSeNecessario(rowH + 2);
      pdf.setFillColor(248, 248, 248);
      pdf.setDrawColor(rBord, gBord, bBord);
      pdf.rect(margin, y - 5, contentW, rowH, "FD");

      pdf.setFont(fontePdf, "normal");
      pdf.setFontSize(tamanhoServico);
      pdf.setTextColor(rSrv, gSrv, bSrv);
      const nomeLinha =
        pdf.splitTextToSize(servico.nome, contentW - 40)[0] || servico.nome;
      pdf.text(nomeLinha, margin + 3, y);
      pdf.text(`R$ ${money(servico.valor)}`, pageW - margin - 3, y, {
        align: "right",
      });
      y += rowH + 1.5;
    }

    y += pxParaMm(4);
  }

  const observacoes = [
    cfg.observacao1,
    cfg.observacao2,
    cfg.observacao3,
    cfg.observacao4,
  ].filter((texto) => texto.trim());

  if (observacoes.length > 0) {
    y += 6;
    novaPaginaSeNecessario(observacoes.length * 5 + 4);
    pdf.setFont(fontePdf, "normal");
    pdf.setFontSize(tamanhoServico);
    pdf.setTextColor(rSrv, gSrv, bSrv);
    for (const texto of observacoes) {
      novaPaginaSeNecessario(6);
      pdf.text(texto, margin, y);
      y += 5;
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
