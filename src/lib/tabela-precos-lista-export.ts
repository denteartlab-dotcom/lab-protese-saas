import {
  cabecalhoRelatorioLaboratorio,
  carregarConfigLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";
import { baixarExcel } from "@/lib/exportar-excel";
import { labImpressaoFromConfig, escalaLogoMultiplicador } from "@/lib/lab-logo";
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
  const margin = 14;
  const contentW = pageW - margin * 2;
  const colValorW = 32;
  const colServicoW = contentW - colValorW;
  const colDivX = margin + colServicoW;
  let y = 16;

  const fontePdf = fontePdfImpressao(cfg.tipoFonte);
  const tamanhoTituloTabela = Math.max(9, cfg.tamanhoFonte * 0.65);
  const tamanhoCategoria = Math.max(7.5, cfg.tamanhoFonte * 0.58);
  const tamanhoServico = Math.max(7, (cfg.tamanhoFonte - 2) * 0.55);
  const rowH = Math.max(5.5, pxParaMm(cfg.espacamentoServicos));
  const catHeaderH = Math.max(7, tamanhoCategoria + 3);
  const gapEntreTabelas = Math.max(4, pxParaMm(cfg.espacamentoCategorias));
  const [rCat, gCat, bCat] = hexParaRgb(cfg.corCategorias);
  const [rSrv, gSrv, bSrv] = hexParaRgb(cfg.corServicos);
  const [rBord, gBord, bBord] = hexParaRgb(cfg.corBordas);
  const alinhamento = alinhamentoPdfImpressao(cfg.alinhamentoCategoria);

  function xCategoria() {
    if (alinhamento === "left") return margin + 2;
    if (alinhamento === "right") return pageW - margin - 2;
    return centerX;
  }

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  function linhaHorizontal(yPos: number) {
    pdf.setDrawColor(rBord, gBord, bBord);
    pdf.setLineWidth(0.15);
    pdf.line(margin, yPos, margin + contentW, yPos);
  }

  function desenharCabecalhoSmart() {
    const lab = labImpressaoFromConfig();
    const cab = cabecalhoPdfTabela(tabela);
    const nomeLab = lab.marca?.trim() || cab.nome;
    const telefone =
      lab.telefones?.trim() ||
      cab.telefone ||
      telefoneWhatsappLaboratorio(carregarConfigLaboratorio());
    const email = lab.email?.trim() || cab.email;

    const dataUrl = lab.logoDataUrl?.trim();
    if (dataUrl?.startsWith("data:image")) {
      const s = escalaLogoMultiplicador(lab.logoTamanho);
      const logoW = 22 * s;
      const logoH = 16 * s;
      const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
      try {
        pdf.addImage(dataUrl, fmt, centerX - logoW / 2, y, logoW, logoH);
        y += logoH + 3;
      } catch {
        /* sem logo */
      }
    }

    pdf.setFont(fontePdf, "bold");
    pdf.setFontSize(tamanhoTituloTabela + 1);
    pdf.setTextColor(30, 30, 30);
    pdf.text(nomeLab, centerX, y, { align: "center" });
    y += 5;

    if (lab.marcaSubtitulo?.trim()) {
      pdf.setFont(fontePdf, "normal");
      pdf.setFontSize(tamanhoServico);
      pdf.setTextColor(90, 90, 90);
      pdf.text(lab.marcaSubtitulo.trim(), centerX, y, { align: "center" });
      y += 4.5;
    }

    pdf.setFont(fontePdf, "normal");
    pdf.setFontSize(tamanhoServico);
    pdf.setTextColor(60, 60, 60);
    if (telefone) {
      pdf.text(telefone, centerX, y, { align: "center" });
      y += 4;
    }
    if (email) {
      pdf.text(email, centerX, y, { align: "center" });
      y += 4;
    }

    y += 2;
    linhaHorizontal(y);
    y += 6;
  }

  if (cfg.mostrarCabecalho) {
    desenharCabecalhoSmart();
  }

  const tituloDoc = (cfg.titulo.trim() || tabela).toUpperCase();
  pdf.setFont(fontePdf, "bold");
  pdf.setFontSize(tamanhoTituloTabela);
  pdf.setTextColor(rCat, gCat, bCat);
  pdf.text(tituloDoc, centerX, y, { align: "center" });
  y += 5;
  linhaHorizontal(y);
  y += gapEntreTabelas;

  function desenharBlocoCategoria(categoria: CategoriaTabelaPrecoExport) {
    const itens = categoria.servicos.filter((servico) => !servico.oculto);
    if (itens.length === 0) return;

    const blockH = catHeaderH + itens.length * rowH;
    novaPaginaSeNecessario(blockH + gapEntreTabelas);
    const blockTop = y;

    pdf.setDrawColor(rBord, gBord, bBord);
    pdf.setLineWidth(0.2);

    pdf.setFillColor(248, 248, 248);
    pdf.rect(margin, blockTop, contentW, catHeaderH, "FD");
    linhaHorizontal(blockTop + catHeaderH);

    pdf.setFont(fontePdf, "bold");
    pdf.setFontSize(tamanhoCategoria);
    pdf.setTextColor(rCat, gCat, bCat);
    const nomeCategoria = categoria.nome.trim().toUpperCase();
    pdf.text(nomeCategoria, xCategoria(), blockTop + catHeaderH / 2 + 1, {
      align: alinhamento,
    });

    let rowY = blockTop + catHeaderH;
    for (const servico of itens) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(margin, rowY, contentW, rowH, "F");

      pdf.setFont(fontePdf, "normal");
      pdf.setFontSize(tamanhoServico);
      pdf.setTextColor(rSrv, gSrv, bSrv);

      const nomeLinha =
        pdf.splitTextToSize(servico.nome, colServicoW - 6)[0] || servico.nome;
      pdf.text(nomeLinha, margin + 2.5, rowY + rowH / 2 + 1);
      pdf.text(`R$ ${money(servico.valor)}`, margin + contentW - 2.5, rowY + rowH / 2 + 1, {
        align: "right",
      });

      rowY += rowH;
      linhaHorizontal(rowY);
    }

    pdf.setDrawColor(rBord, gBord, bBord);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, blockTop, contentW, blockH, "S");
    pdf.line(colDivX, blockTop, colDivX, blockTop + blockH);

    y = blockTop + blockH + gapEntreTabelas;
  }

  for (const categoria of categorias) {
    desenharBlocoCategoria(categoria);
  }

  const observacoes = [
    cfg.observacao1,
    cfg.observacao2,
    cfg.observacao3,
    cfg.observacao4,
  ].filter((texto) => texto.trim());

  if (observacoes.length > 0) {
    y += 2;
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
