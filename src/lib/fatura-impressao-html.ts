import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
import { cabecalhoRelatorioLaboratorio, nomeUsuarioDocumentosLaboratorio, type ConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  formatoPorModeloFatura,
  resolverLayoutFaturaImpressao,
  type ConfiguracoesFaturas,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import { parseParcelaNaDescricao, textoParcelaLog } from "@/lib/fatura-financeiro-util";
import {
  FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
  isCreditoUtilizadoFatura,
  type LancamentoResumoFatura,
} from "@/lib/fatura-cliente-financeiro";
import {
  creditosUtilizadosDaFatura,
  recebimentosParciaisDaFatura,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";
import { resolverDataFinalizadoImpressao } from "@/lib/os-itens-impressao";
import {
  classificarItemOs,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import { osExternaAgenda } from "@/lib/agenda-producao-grupo";
import {
  FATURA_A4_ALTURA_MM,
  FATURA_A4_LARGURA_MM,
  FATURA_SMART_INSET_LINHA_MM,
  FATURA_SMART_MARGEM_LATERAL_MM,
  FATURA_SMART_ESPACO_ASSINATURA_PIX_MM,
  FATURA_SMART_ESPACO_OBS_RODAPE_MM,
  FATURA_SMART_ESPACO_RODAPE_MM,
  FATURA_SMART_CABECALHO_INSET_MM,
  FATURA_SMART_CONTEUDO_INSET_MM,
  FATURA_SMART_PADDING_TOPO_MM,
  FATURA_TERMICA_LARGURA_MM,
  PREVIEW_FATURA_AMOSTRA,
  type FaturaModeloLayout,
} from "@/lib/fatura-modelo-layout";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";
import {
  normalizarCorBorda,
  OS_REQUISICAO_BORDA_PADDING_MM,
  OS_REQUISICAO_LINHA_PREVIEW_PX,
  OS_REQUISICAO_MARGEM_CONTEUDO_MM,
  OS_REQUISICAO_PREVIEW_INSET_MM,
} from "@/lib/os-modelo1-layout";
export type OpcoesHtmlFaturaImpressao = {
  formato: "a4" | "termica";
  modelo: ModeloFaturaId;
  /** Oculta o botão «Imprimir» no HTML (pré-visualização em Configurações). */
  ocultarBotaoImprimir?: boolean;
  /** Layout do editor (preview ao vivo) — impressão usa config salva se omitido. */
  layoutOverride?: FaturaModeloLayout;
};

export type TrabalhoFaturaImpressao = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor: number;
  status?: string;
  dentes?: string | null;
  cor?: string | null;
  instrucoes?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  updatedAt?: string | null;
  cliente?: { nome?: string | null; cro?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

export type LancamentoFaturaImpressao = {
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

export type LinhaFaturaImpressao = {
  os: string;
  osExterna: string;
  dataOs: string;
  finalizado: string;
  cor: string;
  servico: string;
  dentes: string;
  paciente: string;
  qtd: string;
  unitario: string;
  desconto: string;
  subtotal: string;
  segmento: SegmentoFaturamento;
};

export type ParcelaFaturaImpressao = {
  parcela: string;
  vencimento: string;
  forma: string;
  valor: string;
  pago: string;
  /** Linha de pagamento recebido — destaque verde claro. */
  recebida?: boolean;
};

export type DadosFaturaImpressao = {
  numeroFatura: number;
  clienteNome: string;
  dentista: string;
  observacao: string;
  dataEmissao: string;
  usuario: string;
  creditoFatura: number;
  clienteTelefones?: string;
  clienteEmail?: string;
  clienteEndereco?: string;
  ultimoPgto?: string;
  saldoAnterior?: string;
  descontoServicos?: number;
  linhas: LinhaFaturaImpressao[];
  parcelas: ParcelaFaturaImpressao[];
  totalServicos: number;
  totalFinal: number;
};

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatarMoedaReais(valor: string | number, money: (n: number) => string) {
  if (typeof valor === "string") {
    const texto = valor.trim();
    if (/^R\$\s*/i.test(texto)) return texto;
    const n = parseMoney(texto);
    return `R$ ${money(n)}`;
  }
  return `R$ ${money(valor)}`;
}

function dataSomenteEmissao(dataEmissao: string) {
  const parte = dataEmissao.trim().split(/\s+/)[0];
  return parte || dataEmissao;
}

function contarColunasItensSmart(layout: FaturaModeloLayout) {
  let n = 0;
  if (layout.numOs) n += 1;
  if (layout.qtd) n += 1;
  if (layout.servico) n += 1;
  if (layout.numDente) n += 1;
  if (layout.paciente) n += 1;
  if (layout.valorUnit) n += 1;
  if (layout.desconto) n += 1;
  if (layout.subtotal) n += 1;
  return n;
}

function osExternaResumoFatura(linhas: LinhaFaturaImpressao[]): string {
  const valores = [
    ...new Set(
      linhas
        .map((linha) => (linha.osExterna || "").trim())
        .filter((valor) => valor && valor !== "-")
    ),
  ];
  return valores.length ? valores.join(", ") : "—";
}

function htmlMetaDatasFaturaLinha(
  linha: LinhaFaturaImpressao,
  layout: FaturaModeloLayout,
  rotuloFinalizado = "Finalizado",
  termica = false
): string {
  if (linha.segmento !== "servico") return "";
  const temData = layout.data;
  const temFinalizado = layout.finalizado;
  if (!temData && !temFinalizado) return "";

  const partes: string[] = [];
  if (temData) {
    partes.push(`<strong>Data:</strong> ${escapeHtml(linha.dataOs)}`);
  }
  if (temFinalizado) {
    partes.push(
      `<strong>${escapeHtml(rotuloFinalizado)}:</strong> ${escapeHtml(linha.finalizado)}`
    );
  }

  const conteudo =
    temData && temFinalizado
      ? `${partes[0]} <span class="meta-data-sep">|</span> ${partes[1]}`
      : partes[0];

  const wrapStyle = termica ? ' style="margin:0;line-height:1.35"' : "";
  return `<div class="meta-linha-datas"${wrapStyle}><span class="meta-data-item">${conteudo}</span></div>`;
}

function metaLinhaOsSmart(linha: LinhaFaturaImpressao, layout: FaturaModeloLayout) {
  return htmlMetaDatasFaturaLinha(linha, layout, "Finalizado");
}

function trMetaAbaixoServico(
  htmlMeta: string,
  layout: FaturaModeloLayout,
  totalColunas: number,
  qtdAntesServico: boolean
) {
  let colunasUsadas = 0;
  let cells = "";
  if (layout.numOs) {
    cells += "<td></td>";
    colunasUsadas += 1;
  }
  if (qtdAntesServico && layout.qtd) {
    cells += '<td class="center"></td>';
    colunasUsadas += 1;
  }
  if (layout.servico) {
    cells += `<td>${htmlMeta}</td>`;
    colunasUsadas += 1;
    const restante = totalColunas - colunasUsadas;
    if (restante > 0) cells += `<td colspan="${restante}"></td>`;
    return `<tr class="meta-row">${cells}</tr>`;
  }
  const colspan = layout.numOs ? Math.max(1, totalColunas - 1) : totalColunas;
  return `<tr class="meta-row">${layout.numOs ? "<td></td>" : ""}<td colspan="${colspan}">${htmlMeta}</td></tr>`;
}

function colunasLarguraSmart(layout: FaturaModeloLayout) {
  const cols: string[] = [];
  if (layout.numOs) cols.push("5%");
  if (layout.qtd) cols.push("5%");
  if (layout.servico) cols.push("22%");
  if (layout.numDente) cols.push("11%");
  if (layout.paciente) cols.push("13%");
  if (layout.valorUnit) cols.push("13%");
  if (layout.desconto) cols.push("9%");
  if (layout.subtotal) cols.push("13%");
  return cols.map((w) => `<col style="width:${w}" />`).join("");
}

function parseMoney(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function itensTrabalhoFatura(trabalho: TrabalhoFaturaImpressao) {
  const itens = (trabalho.instrucoes || "")
    .split("\n")
    .map((line) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
      );
      if (!match) return null;
      const servico = match[1]?.trim() || trabalho.tipoProtese;
      const produtoId = line.match(/ - produtoId ([^\s-]+)/i)?.[1]?.trim();
      return {
        servico,
        dentes: match[2]?.trim() || trabalho.dentes || "-",
        cor: match[3]?.trim() || trabalho.cor || "-",
        quantidade: match[4]?.trim() || "1",
        valor: parseMoney(
          line.match(
            / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
          )?.[1] || match[5] || ""
        ),
        produtoId,
        segmento: classificarItemOs({ servico, produtoId }),
      };
    })
    .filter(Boolean) as Array<{
    servico: string;
    dentes: string;
    cor: string;
    quantidade: string;
    valor: number;
    produtoId?: string;
    segmento: SegmentoFaturamento;
  }>;

  return itens.length
    ? itens
    : [
        {
          servico: trabalho.tipoProtese,
          dentes: trabalho.dentes || "-",
          cor: trabalho.cor || "-",
          quantidade: "1",
          valor: trabalho.valor || 0,
          segmento: classificarItemOs({ servico: trabalho.tipoProtese }),
        },
      ];
}

function montarParcelasCondicaoPagamentoFatura(params: {
  lancamento: LancamentoFaturaImpressao;
  clienteId?: string;
  clienteNome?: string;
  lancamentos?: LancamentoResumoFatura[];
  totalServicos: number;
  totalFinal: number;
  formatDate: (iso: string) => string;
  money: (n: number) => string;
}): ParcelaFaturaImpressao[] {
  const { lancamento, totalServicos, totalFinal, formatDate, money } = params;
  const parcela = parseParcelaNaDescricao(lancamento.descricao);
  const parcelaTexto = textoParcelaLog(parcela?.numero ?? 1, parcela?.total ?? 1);
  const lancamentos = params.lancamentos || [];
  const lancamentoCliente: LancamentoContasReceber | null = params.clienteId
    ? {
        id: "",
        tipo: "receita",
        ...lancamento,
        cliente: { id: params.clienteId, nome: params.clienteNome || "" },
      }
    : null;

  const parciais = lancamentoCliente
    ? recebimentosParciaisDaFatura(lancamentoCliente, lancamentos).sort((a, b) =>
        a.data.localeCompare(b.data)
      )
    : [];

  const creditos = lancamentoCliente
    ? creditosUtilizadosDaFatura(lancamentoCliente, lancamentos)
        .filter((item) => isCreditoUtilizadoFatura(item.descricao))
        .sort((a, b) => a.data.localeCompare(b.data))
    : [];

  const creditoTotal = creditos.reduce((sum, item) => sum + item.valor, 0);
  const parciaisTotal = parciais.reduce((sum, item) => sum + item.valor, 0);
  const totalPago = creditoTotal + parciaisTotal;
  const quitada =
    lancamento.status === "pago" || totalPago >= Math.max(totalFinal, 0) - 0.009;

  const parcelas: ParcelaFaturaImpressao[] = [
    {
      parcela: parcelaTexto,
      vencimento: formatDate(lancamento.data),
      forma: lancamento.formaPagamento || "-",
      valor: money(totalServicos),
      pago: money(quitada ? totalServicos : totalPago),
      recebida: quitada,
    },
  ];

  if (quitada) return parcelas;

  for (const credito of creditos) {
    parcelas.push({
      parcela: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
      vencimento: formatDate(credito.data),
      forma: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
      valor: money(credito.valor),
      pago: money(credito.valor),
      recebida: true,
    });
  }

  for (const parcial of parciais) {
    parcelas.push({
      parcela: "Pagamento parcial",
      vencimento: formatDate(parcial.data),
      forma: parcial.formaPagamento || "-",
      valor: money(parcial.valor),
      pago: money(parcial.valor),
      recebida: true,
    });
  }

  return parcelas;
}

export function montarDadosFaturaImpressao(params: {
  numeroFatura: number;
  clienteNome: string;
  lancamento: LancamentoFaturaImpressao;
  trabalhos: TrabalhoFaturaImpressao[];
  creditoFatura?: number;
  valorRecebido?: number;
  clienteId?: string;
  lancamentosCliente?: LancamentoResumoFatura[];
  ultimoPgto?: string;
  saldoAnterior?: string;
  clienteTelefones?: string;
  clienteEmail?: string;
  clienteEndereco?: string;
  formatDate: (iso: string) => string;
  money: (n: number) => string;
}): DadosFaturaImpressao {
  const { numeroFatura, clienteNome, lancamento, trabalhos, formatDate, money } = params;
  const creditoFatura = params.creditoFatura ?? 0;
  const pack = desempacotarDespesa(lancamento.descricao);
  const textoDescricao = pack.texto.replace(/@@trab:[a-zA-Z0-9_,-]+@@/gi, "").trim();
  const observacao = textoDescricao.toLowerCase().startsWith("cobrança os")
    ? textoDescricao.split(" - ").slice(1).join(" - ").trim()
    : textoDescricao;

  const linhas: LinhaFaturaImpressao[] = [];
  let totalServicos = 0;

  if (trabalhos.length) {
    for (const trabalho of trabalhos) {
      const dataOs = trabalho.dataPrevista ? formatDate(trabalho.dataPrevista) : formatDate(lancamento.data);
      const finalizado =
        resolverDataFinalizadoImpressao({
          status: trabalho.status || "",
          dataEntrega: trabalho.dataEntrega,
          updatedAt: trabalho.updatedAt,
        }) || "-";
      const osExterna = osExternaAgenda(trabalho.instrucoes) || "-";
      for (const item of itensTrabalhoFatura(trabalho)) {
        const qtd = Number(String(item.quantidade).replace(",", ".")) || 1;
        const subtotal = item.valor;
        const valorUnitario = qtd > 0 ? item.valor / qtd : item.valor;
        totalServicos += subtotal;
        linhas.push({
          os: String(trabalho.numeroOs),
          osExterna,
          dataOs,
          finalizado,
          cor: item.cor,
          servico: item.servico,
          dentes: item.dentes,
          paciente: trabalho.paciente?.nome?.trim() || "-",
          qtd: item.quantidade,
          unitario: money(valorUnitario),
          desconto: "0,00 %",
          subtotal: money(subtotal),
          segmento: item.segmento,
        });
      }
    }
  } else {
    totalServicos = lancamento.valor;
    linhas.push({
      os: lancamento.trabalho?.numeroOs ? String(lancamento.trabalho.numeroOs) : "-",
      osExterna: "-",
      dataOs: formatDate(lancamento.data),
      finalizado: "-",
      cor: "-",
      servico: observacao || lancamento.descricao,
      dentes: "-",
      paciente: "-",
      qtd: "1",
      unitario: money(lancamento.valor),
      desconto: "0,00 %",
      subtotal: money(lancamento.valor),
      segmento: classificarItemOs({ servico: observacao || lancamento.descricao }),
    });
  }

  const totalFinal = Math.max(totalServicos - creditoFatura, 0);
  const agora = new Date();

  return {
    numeroFatura,
    clienteNome,
    dentista: trabalhos[0]?.cliente?.nome?.trim() || clienteNome,
    observacao,
    dataEmissao: `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    usuario: "—",
    creditoFatura,
    clienteTelefones: params.clienteTelefones,
    clienteEmail: params.clienteEmail,
    clienteEndereco: params.clienteEndereco,
    ultimoPgto: params.ultimoPgto,
    saldoAnterior: params.saldoAnterior,
    linhas,
    parcelas: montarParcelasCondicaoPagamentoFatura({
      lancamento,
      clienteId: params.clienteId,
      clienteNome: params.clienteNome,
      lancamentos: params.lancamentosCliente,
      totalServicos,
      totalFinal,
      formatDate,
      money,
    }),
    totalServicos,
    totalFinal,
  };
}

function parsePreviewMoney(valor: string) {
  const normalized = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Dados de amostra para pré-visualização do Modelo 1 em Configurações → Faturas. */
export function montarDadosFaturaPreviewAmostra(): DadosFaturaImpressao {
  const a = PREVIEW_FATURA_AMOSTRA;
  return {
    numeroFatura: a.numFatura,
    clienteNome: a.cliente,
    dentista: a.dentista,
    observacao: a.observacao,
    dataEmissao: a.data,
    usuario: a.usuario,
    creditoFatura: 0,
    clienteTelefones: a.telefones,
    clienteEmail: a.email,
    clienteEndereco: a.endereco,
    ultimoPgto: a.ultimoPgto,
    saldoAnterior: a.saldoAnterior,
    descontoServicos: parsePreviewMoney(a.descontoServicos),
    linhas: a.linhas.map((linha) => ({
      os: linha.os,
      osExterna: linha.osExterna,
      dataOs: linha.dataOs,
      finalizado: linha.finalizado,
      cor: linha.cor,
      servico: linha.servico,
      dentes: linha.dentes,
      paciente: linha.paciente,
      qtd: linha.qtd,
      unitario: linha.unitario.replace(/^R\$\s*/i, ""),
      desconto: linha.desconto,
      subtotal: linha.subtotal.replace(/^R\$\s*/i, ""),
      segmento: classificarItemOs({ servico: linha.servico }),
    })),
    parcelas: a.parcelas.map((p) => ({
      parcela: p.parcela,
      vencimento: p.vencimento,
      forma: p.forma,
      valor: p.valor.replace(/^R\$\s*/i, ""),
      pago: "0,00",
    })),
    totalServicos: parsePreviewMoney(a.totalServicos),
    totalFinal: parsePreviewMoney(a.total),
  };
}

function isFaturaA4Smart(modelo: ModeloFaturaId) {
  return modelo === "modelo1" || modelo === "modelo2" || modelo === "modelo3";
}

function linhaRotuloValor(rotulo: string, valor: string) {
  return `<p><span style="font-weight:bold">${escapeHtml(rotulo)} </span>${escapeHtml(valor)}</p>`;
}

function linhaDivisoria(cor = "#000", insetMm = OS_REQUISICAO_PREVIEW_INSET_MM) {
  if (insetMm <= 0) {
    return `<div style="width:100%;border-top:${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor};box-sizing:border-box"></div>`;
  }
  return `<div style="margin-left:-${insetMm}mm;margin-right:-${insetMm}mm;width:calc(100% + ${insetMm * 2}mm);border-top:${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor};box-sizing:border-box"></div>`;
}

function linhaDivisoriaSmart(insetMm = FATURA_SMART_INSET_LINHA_MM) {
  return linhaDivisoria("#000", insetMm);
}

function linhaDivisoriaCinza() {
  return linhaDivisoria("#bdbdbd");
}

function htmlLogo(cfg: ConfigLaboratorio, layout: FaturaModeloLayout, termica: boolean) {
  if (!layout.logo || !cfg.logoDataUrl?.startsWith("data:image")) return "";
  if (termica) {
    return `<img src="${cfg.logoDataUrl}" alt="Logo" style="width:${layout.logoTamanhoPx}px;height:${Math.round(layout.logoTamanhoPx * 0.85)}px;object-fit:contain" />`;
  }
  const cab = normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao);
  const escala = escalaLogoMultiplicador(cfg.logoTamanho);
  const logoW = Math.round(cab.logoTamanhoPx * escala);
  const logoH = Math.round(logoW * 0.75);
  return `<img src="${cfg.logoDataUrl}" alt="Logo" style="width:${logoW}px;height:${logoH}px;object-fit:contain" />`;
}

function molduraHtml(layout: FaturaModeloLayout, insetMm = OS_REQUISICAO_PREVIEW_INSET_MM) {
  if (!layout.exibirBordas) return "";
  const cor = normalizarCorBorda(layout.bordas);
  const lateral =
    insetMm > 0
      ? `left:-${insetMm}mm;right:-${insetMm}mm;width:calc(100% + ${insetMm * 2}mm)`
      : "left:0;right:0;width:100%";
  return `<div aria-hidden="true" style="position:absolute;top:-${OS_REQUISICAO_BORDA_PADDING_MM}mm;${lateral};bottom:-${OS_REQUISICAO_BORDA_PADDING_MM}mm;border:${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor};pointer-events:none;box-sizing:border-box"></div>`;
}

function contarColunasItensFatura(layout: FaturaModeloLayout) {
  let n = 0;
  if (layout.numOs) n += 1;
  if (layout.servico) n += 1;
  if (layout.numDente) n += 1;
  if (layout.paciente) n += 1;
  if (layout.qtd) n += 1;
  if (layout.valorUnit) n += 1;
  if (layout.desconto) n += 1;
  if (layout.subtotal) n += 1;
  return n;
}

function estilosBaseA4(fs: number, smartModelo1: boolean) {
  const fsTabela = smartModelo1 ? fs : Math.max(7, fs - 1);
  const fsCab = smartModelo1 ? fs : Math.max(7, fs - 2);
  const thBg = smartModelo1 ? "#fff" : "#d9d9d9";
  const smartTableCss = smartModelo1
    ? `
    table.items.smart,table.items.pay.smart{border-collapse:collapse}
    table.items.smart th,table.items.pay.smart th{
      background:#fff;
      font-weight:bold;
      border-bottom:none;
      padding:4px 3px;
    }
    table.items.smart td,table.items.pay.smart td{background:#fff}
    table.items.smart .cel-servico{line-height:1.35;word-break:break-word;overflow-wrap:break-word;padding-bottom:2px}
    table.items.smart tr.meta-row td{padding-top:2px;padding-bottom:4px}
    table.items.smart thead tr,table.items.pay.smart thead tr{background:#fff}
  `
    : "";
  const pageCss = smartModelo1
    ? `width:${FATURA_A4_LARGURA_MM}mm;min-height:${FATURA_A4_ALTURA_MM}mm;max-width:${FATURA_A4_LARGURA_MM}mm;margin:0 auto;padding:${FATURA_SMART_PADDING_TOPO_MM}mm ${FATURA_SMART_MARGEM_LATERAL_MM}mm ${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm;box-sizing:border-box`
    : "width:100%;max-width:190mm;margin:0 auto;padding:0;overflow:hidden";
  const pagePrintCss = smartModelo1
    ? `width:${FATURA_A4_LARGURA_MM}mm;min-height:${FATURA_A4_ALTURA_MM}mm;max-width:${FATURA_A4_LARGURA_MM}mm;margin:0 auto;padding:${FATURA_SMART_PADDING_TOPO_MM}mm ${FATURA_SMART_MARGEM_LATERAL_MM}mm ${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm;box-sizing:border-box;overflow:visible`
    : "width:100%;max-width:190mm;margin:0 auto;padding:0;overflow:visible";
  return `<style>
    @page{size:A4 portrait;margin:${smartModelo1 ? "0" : "8mm 10mm"}}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:${fs}px}
    .page{${pageCss}}
    .actions{text-align:right;margin-bottom:8px}
    .rule{border-top:2px solid #111;margin:0}
    .rule-thin{border-top:1px solid #777;margin:0}
    table{border-collapse:collapse;width:100%;table-layout:fixed}
    th,td{border:none;padding:2px 3px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word}
    .items th{font-size:${fsCab}px;font-weight:bold;text-align:left;padding:4px 3px;background:${thBg}}
    .items td{font-size:${fsTabela}px;line-height:1.25}
    .items tr.meta-row td{padding-top:1px;padding-bottom:5px}
    .items tr.meta-row td .meta-linha-datas{margin:0;line-height:1.35}
    .items tr.meta-row td .meta-data-item{font-size:${Math.max(10, fs - 2)}px;color:#111;line-height:1.35}
    .items tr.meta-row td .meta-data-sep{margin:0 4px;font-weight:normal;color:#111}
    .pay th{font-size:${fsCab}px;font-weight:bold;text-align:left;padding:4px 3px;background:${thBg}}
    .pay td{font-size:${fsTabela}px;line-height:1.35;padding:4px 3px}
    .pay tr.pay-row-received td{color:#5cb85c;background:#fff}
    .pay tr.pay-row-received td.pay-col-pago{font-weight:600}
    .right{text-align:right}
    .center{text-align:center}
    .totals{width:${smartModelo1 ? "260px" : "270px"};max-width:100%;margin-left:auto;padding-top:4px}
    .totals div{display:grid;grid-template-columns:1fr 92px;gap:8px;padding:2px 0;align-items:baseline}
    .totals .right{text-align:right;justify-self:end}
    .totals strong{font-weight:bold}
    ${smartTableCss}
    @media print{
      .actions{display:none}
      html,body{width:100%;margin:0;padding:0;background:#fff}
      .page{${pagePrintCss}}
      table{page-break-inside:auto}
      tr{page-break-inside:avoid;page-break-after:auto}
    }
    @media screen{
      html,body{background:#525659}
      .page{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    }
  </style>`;
}

function estilosBaseTermica(fs: number) {
  return `<style>
    @page{size:80mm auto;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
    .page{width:${FATURA_TERMICA_LARGURA_MM}mm;max-width:100%;margin:0 auto;padding:3mm 2mm;font-size:${fs}px}
    .actions{text-align:right;margin-bottom:6px}
    table{border-collapse:collapse;width:100%}
    th,td{padding:1px 2px;vertical-align:top}
    .right{text-align:right}
    @media print{.actions{display:none}html,body{background:#fff}}
    @media screen{html,body{background:#525659}.page{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2)}}
  </style>`;
}

function celulaOsFatura(
  linha: LinhaFaturaImpressao,
  novaOs: boolean,
  layout: FaturaModeloLayout
): string {
  if (!layout.numOs) return "";
  if (!novaOs) return "<td></td>";
  return `<td style="vertical-align:top">${escapeHtml(linha.os)}</td>`;
}

function htmlTabelaItensA4(
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  fs: number,
  smartModelo1 = false,
  money: (n: number) => string = (n) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
) {
  if (smartModelo1) {
    const colgroup = `<colgroup>${colunasLarguraSmart(layout)}</colgroup>`;
    const cabecalho = `<thead><tr>
      ${layout.numOs ? "<th>OS</th>" : ""}
      ${layout.qtd ? '<th class="center">Qtd</th>' : ""}
      ${layout.servico ? "<th>Serviços/Produtos</th>" : ""}
      ${layout.numDente ? "<th>Num Dente</th>" : ""}
      ${layout.paciente ? "<th>Paciente</th>" : ""}
      ${layout.valorUnit ? '<th class="right">Unitário</th>' : ""}
      ${layout.desconto ? '<th class="right">Desc</th>' : ""}
      ${layout.subtotal ? '<th class="right">Subtotal</th>' : ""}
    </tr></thead>`;

    let osAnterior = "";
    const colunas = contarColunasItensSmart(layout);
    const linhas = dados.linhas
      .flatMap((linha) => {
        const novaOs = linha.os !== osAnterior;
        osAnterior = linha.os;
        const trPrincipal = `<tr>
          ${layout.numOs ? celulaOsFatura(linha, novaOs, layout) : ""}
          ${layout.qtd ? `<td class="center">${escapeHtml(linha.qtd)}</td>` : ""}
          ${layout.servico ? `<td class="cel-servico">${escapeHtml(linha.servico)}</td>` : ""}
          ${layout.numDente ? `<td>${escapeHtml(linha.dentes)}</td>` : ""}
          ${layout.paciente ? `<td>${escapeHtml(linha.paciente)}</td>` : ""}
          ${layout.valorUnit ? `<td class="right">${escapeHtml(formatarMoedaReais(linha.unitario, money))}</td>` : ""}
          ${layout.desconto ? `<td class="right">${escapeHtml(linha.desconto)}</td>` : ""}
          ${layout.subtotal ? `<td class="right">${escapeHtml(formatarMoedaReais(linha.subtotal, money))}</td>` : ""}
        </tr>`;

        const meta = metaLinhaOsSmart(linha, layout);
        if (!meta) return [trPrincipal];

        const trMeta = trMetaAbaixoServico(meta, layout, colunas, true);
        return [trPrincipal, trMeta];
      })
      .join("");

    return `<div style="margin:2px 0 4px">
      ${linhaDivisoriaSmart()}
      <table class="items smart" style="margin-bottom:0">
        ${colgroup}
        ${cabecalho}
      </table>
      ${linhaDivisoriaSmart()}
      <table class="items smart" style="margin-top:0">
        ${colgroup}
        <tbody>${linhas}</tbody>
      </table>
      ${linhaDivisoriaSmart()}
    </div>`;
  }

  const cabecalho = `<thead><tr>
    ${layout.numOs ? '<th>Os</th>' : ""}
    ${layout.servico ? '<th>Serviço/Produto</th>' : ""}
    ${layout.numDente ? '<th>Número Dente</th>' : ""}
    ${layout.paciente ? '<th>Paciente</th>' : ""}
    ${layout.qtd ? '<th class="center">Qtd</th>' : ""}
    ${layout.valorUnit ? '<th class="right">Unitário</th>' : ""}
    ${layout.desconto ? '<th class="right">Desc</th>' : ""}
    ${layout.subtotal ? '<th class="right">Subtotal</th>' : ""}
  </tr></thead>`;

  let osAnterior = "";
  const colunas = contarColunasItensFatura(layout);
  const linhas = dados.linhas
    .flatMap((linha) => {
      const novaOs = linha.os !== osAnterior;
      osAnterior = linha.os;
      const trPrincipal = `<tr>
        ${layout.numOs ? celulaOsFatura(linha, novaOs, layout) : ""}
        ${layout.servico ? `<td>${escapeHtml(linha.servico)}</td>` : ""}
        ${layout.numDente ? `<td>${escapeHtml(linha.dentes)}</td>` : ""}
        ${layout.paciente ? `<td>${escapeHtml(linha.paciente)}</td>` : ""}
        ${layout.qtd ? `<td class="center">${escapeHtml(linha.qtd)}</td>` : ""}
        ${layout.valorUnit ? `<td class="right">${escapeHtml(linha.unitario)}</td>` : ""}
        ${layout.desconto ? `<td class="right">% 0,00</td>` : ""}
        ${layout.subtotal ? `<td class="right">${escapeHtml(linha.subtotal)}</td>` : ""}
      </tr>`;

      if (linha.segmento !== "servico" || !(layout.data || layout.finalizado)) {
        return [trPrincipal];
      }

      const trMeta = trMetaAbaixoServico(
        htmlMetaDatasFaturaLinha(linha, layout, "Entregue"),
        layout,
        colunas,
        false
      );
      return [trPrincipal, trMeta];
    })
    .join("");

  return `<table class="items" style="font-size:${fs}px">
    ${cabecalho}
    <tbody>${linhas}</tbody>
  </table>`;
}

function htmlTotaisA4(
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  modelo: ModeloFaturaId,
  fs: number,
  money: (n: number) => string
) {
  const saldoAnteriorNosTotais = modelo === "modelo3" && layout.saldoAnterior;
  const partes: string[] = [];
  if (layout.totalServicos) {
    const rotulo =
      modelo === "modelo1"
        ? "Total Serviços (+)"
        : modelo === "modelo2"
          ? "Total Serviços/Produtos (=)"
          : modelo === "modelo3"
            ? "Total Serviços (=)"
            : "Total Serviços (+)";
    partes.push(
      `<div><span>${rotulo}</span><strong class="right">${escapeHtml(formatarMoedaReais(dados.totalServicos, money))}</strong></div>`
    );
  }
  if (saldoAnteriorNosTotais) {
    const saldo =
      dados.saldoAnterior && dados.saldoAnterior !== "0,00"
        ? dados.saldoAnterior.startsWith("-")
          ? dados.saldoAnterior
          : formatarMoedaReais(parsePreviewMoney(dados.saldoAnterior), money)
        : "R$ 0,00";
    partes.push(`<div><span>Saldo Anterior (+)</span><span class="right">${escapeHtml(saldo)}</span></div>`);
  }
  if (layout.descontoServicos) {
    const desconto =
      dados.descontoServicos != null
        ? formatarMoedaReais(dados.descontoServicos, money)
        : "R$ 0,00";
    partes.push(`<div><span>Desconto Serviços (-)</span><span class="right">${escapeHtml(desconto)}</span></div>`);
  }
  if (layout.descontoFatura) {
    partes.push(
      `<div><span>Desconto Fatura (-)</span><span class="right">${escapeHtml(formatarMoedaReais(dados.creditoFatura, money))}</span></div>`
    );
  }
  if (modelo === "modelo2") {
    partes.push(`<div><span>Juros Fatura (+)</span><span class="right">R$ 0,00</span></div>`);
  }
  if (layout.total) {
    partes.push(
      `<div><strong>Total (=)</strong><strong class="right">${escapeHtml(formatarMoedaReais(dados.totalFinal, money))}</strong></div>`
    );
  }
  if (!partes.length) return "";
  return `<div class="totals" style="font-size:${fs}px;margin-top:4px">
    ${partes.join("")}
  </div>`;
}

function valorMonetarioSemPrefixo(valor: string) {
  return valor.trim().replace(/^R\$\s*/i, "");
}

function htmlCondicaoPagamento(
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  fsSmall: number,
  termica: boolean,
  smartModelo1 = false
) {
  if (!layout.condicaoPagamento) return "";
  const exibirPago = !termica;
  const labelForma = "Forma Pagto";

  const linhas = dados.parcelas
    .map((p) => {
      const verde = Boolean(p.recebida);
      return `<tr${verde ? ' class="pay-row-received"' : ""}>
        <td>${escapeHtml(p.parcela)}</td>
        <td>${escapeHtml(p.vencimento)}</td>
        ${layout.formaPgto ? `<td>${escapeHtml(p.forma)}</td>` : ""}
        <td>${escapeHtml(valorMonetarioSemPrefixo(p.valor))}</td>
        ${exibirPago ? `<td>${escapeHtml(valorMonetarioSemPrefixo(p.pago))}</td>` : ""}
      </tr>`;
    })
    .join("");

  const colgroupPay = smartModelo1
    ? `<colgroup>
        <col style="width:18%" />
        <col style="width:18%" />
        ${layout.formaPgto ? '<col style="width:26%" />' : ""}
        <col style="width:${layout.formaPgto ? "19%" : "32%"}" />
        ${exibirPago ? `<col style="width:${layout.formaPgto ? "19%" : "32%"}" />` : ""}
      </colgroup>`
    : "";

  const theadPay = `<thead><tr>
          <th>Parcela</th>
          <th>Vencimento</th>
          ${layout.formaPgto ? `<th>${labelForma}</th>` : ""}
          <th>Valor</th>
          ${exibirPago ? "<th>Pago</th>" : ""}
        </tr></thead>`;

  const tabelaPay = smartModelo1
    ? `${linhaDivisoriaSmart()}
    <p style="font-weight:bold;margin:8px 0 6px">Condição de Pagamento</p>
    <table class="items pay smart" style="margin-bottom:0">
      ${colgroupPay}
      ${theadPay}
    </table>
    ${linhaDivisoriaSmart()}
    <table class="items pay smart" style="margin-top:0;margin-bottom:0">
      ${colgroupPay}
      <tbody>${linhas}</tbody>
    </table>
    ${linhaDivisoriaSmart()}`
    : `<div class="rule-thin" style="margin-bottom:0"></div>
    <p style="font-weight:bold;margin:8px 0 6px">Condição de Pagamento</p>
    <table class="pay">
      ${theadPay}
      <tbody>${linhas}</tbody>
    </table>
    <div class="rule-thin" style="margin-top:0"></div>`;

  return `<div style="margin-top:${smartModelo1 ? 6 : 18}px;font-size:${fsSmall}px">
    ${tabelaPay}
  </div>`;
}

function htmlAssinaturaSmart(fsSmall: number) {
  const fsAssinatura = Math.max(9, fsSmall - 1);
  return `<div style="display:flex;justify-content:center">
    <div style="width:34%;min-width:150px;max-width:200px;text-align:center;font-size:${fsAssinatura}px;line-height:1.2">
      <div style="border-top:1px solid #000"></div>
      <div style="padding-top:3px">Recebi o(s) serviço(s) descritos acima</div>
    </div>
  </div>`;
}

function htmlPixSmart(layout: FaturaModeloLayout, aposAssinatura = false) {
  const qr = layout.pixQrImagem?.startsWith("data:image")
    ? `<img src="${layout.pixQrImagem}" alt="QR PIX" style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;object-fit:contain;display:block" />`
    : `<div style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b7280">QR PIX</div>`;
  const margemTopo = aposAssinatura ? `${FATURA_SMART_ESPACO_ASSINATURA_PIX_MM}mm` : "0";
  return `<div style="display:flex;align-items:flex-end;gap:10px;margin-top:${margemTopo}">${qr}<span style="font-size:${layout.pixQrFonte}px;line-height:1.2">Pagar com PIX</span></div>`;
}

function htmlPixAssinatura(
  layout: FaturaModeloLayout,
  fsSmall: number,
  faturaA4Smart = false,
  aposObservacao = false
) {
  if (!layout.pix && !layout.assinatura) return "";

  if (faturaA4Smart) {
    const blocos: string[] = [];
    if (layout.assinatura) blocos.push(htmlAssinaturaSmart(fsSmall));
    if (layout.pix) blocos.push(htmlPixSmart(layout, layout.assinatura));
    const margemTopo = aposObservacao
      ? `${FATURA_SMART_ESPACO_OBS_RODAPE_MM}mm`
      : `${FATURA_SMART_ESPACO_RODAPE_MM}mm`;
    return `<div class="rodape-fatura-smart" style="margin-top:${margemTopo}">${blocos.join("")}</div>`;
  }

  const qr = layout.pix
    ? layout.pixQrImagem?.startsWith("data:image")
      ? `<img src="${layout.pixQrImagem}" alt="QR PIX" style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;object-fit:contain;display:block" />`
      : `<div style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b7280">QR PIX</div>`
    : "";

  return `<div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:end;font-size:${fsSmall}px;min-height:${layout.pix ? layout.pixQrTamanhoPx : 0}px">
    <div style="display:flex;align-items:center;gap:12px">
      ${layout.pix ? `${qr}<span style="font-size:${layout.pixQrFonte}px">Pagar com PIX</span>` : ""}
    </div>
    ${
      layout.assinatura
        ? `<div style="text-align:center"><div style="width:192px;margin:0 auto 4px;border-top:1px solid #000"></div><p>Recebi o(s) serviço(s) descritos acima</p></div>`
        : "<div></div>"
    }
    <div></div>
  </div>${linhaDivisoriaCinza()}`;
}

function gerarHtmlFaturaA4(
  dados: DadosFaturaImpressao,
  cfg: ConfigLaboratorio,
  layoutRaw: FaturaModeloLayout,
  modelo: ModeloFaturaId,
  money: (n: number) => string,
  ocultarBotaoImprimir = false
) {
  const layout = layoutRaw;
  const faturaA4Smart = isFaturaA4Smart(modelo);
  const lab = configParaLabImpressao(cfg);
  const cab = normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao);
  const textos = montarTextosCabecalhoRequisicao(cfg, lab, cab);
  const fs = layout.tamanhoFonte;
  const fsSmall = faturaA4Smart ? Math.max(11, fs - 1) : Math.max(8, fs - 1);
  const saldoAnteriorNosTotais = modelo === "modelo3" && layout.saldoAnterior;

  const logoHtml = layout.logo ? htmlLogo(cfg, layout, false) : "";
  const dataFatura = dataSomenteEmissao(dados.dataEmissao);

  const cabecalho = faturaA4Smart
    ? `<div class="header" style="display:grid;grid-template-columns:1fr 140px;gap:12px;align-items:start;margin:0 0 8px;padding-top:${FATURA_SMART_CABECALHO_INSET_MM}mm">
        <div style="display:flex;gap:10px;align-items:flex-start;min-width:0">
          ${logoHtml}
          ${
            layout.infoLab
              ? `<div class="lab" style="line-height:1.3;min-width:0">
                  <strong style="display:block;font-size:${fs + 2}px;margin-bottom:3px;font-weight:bold">${escapeHtml(textos.nome || lab.responsavel)}</strong>
                  ${textos.linhas.map((l) => `<span style="display:block;font-size:${fsSmall}px">${escapeHtml(l)}</span>`).join("")}
                </div>`
              : "<div></div>"
          }
        </div>
        ${
          layout.dadosOs
            ? `<div class="invoice" style="text-align:right;line-height:1.35;font-size:${fs}px;white-space:nowrap">
                <span style="font-weight:bold">Fatura</span>
                <strong style="display:block;font-size:${fs + 8}px;line-height:1;font-weight:bold;margin:2px 0">${dados.numeroFatura}</strong>
                ${layout.data ? `<span style="display:block;font-size:${fsSmall}px;font-weight:normal">Data: ${escapeHtml(dataFatura)}</span>` : ""}
                ${layout.usuario ? `<span style="display:block;font-size:${fsSmall}px;font-weight:normal">Usuário: ${escapeHtml(dados.usuario)}</span>` : ""}
              </div>`
            : ""
        }
      </div>`
    : `<div class="header" style="display:grid;grid-template-columns:1fr 132px;gap:12px;align-items:start;margin:0 0 10px">
    ${
      layout.infoLab
        ? `<div class="lab" style="line-height:1.2">
            <strong style="display:block;font-size:16px;margin-bottom:3px">${escapeHtml(textos.nome || lab.responsavel)}</strong>
            ${textos.linhas.map((l) => `<span style="display:block;font-size:13px">${escapeHtml(l)}</span>`).join("")}
          </div>`
        : "<div></div>"
    }
    ${
      layout.dadosOs
        ? `<div class="invoice" style="text-align:right;font-size:18px;line-height:1.1">
            Fatura
            <strong style="display:block;font-size:22px;margin-top:2px">${dados.numeroFatura}</strong>
            ${layout.data ? `<span style="display:block;margin-top:8px;font-size:8px;font-weight:normal">Data: ${escapeHtml(dados.dataEmissao)}</span>` : ""}
          </div>`
        : ""
    }
  </div>`;

  const infoCliente = faturaA4Smart
    ? `<div class="info" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:4px 0 8px;line-height:1.5;font-size:${fsSmall}px">
        <div>
          ${layout.cliente ? `<div><strong>Cliente:</strong> ${escapeHtml(dados.clienteNome)}</div>` : ""}
          ${layout.clienteTel ? `<div><strong>Telefones:</strong> ${escapeHtml(dados.clienteTelefones || "—")}</div>` : ""}
          ${layout.ultimoPgto ? `<div><strong>Último Pgto:</strong> ${escapeHtml(dados.ultimoPgto || "—")}</div>` : ""}
          ${layout.saldoAnterior && !saldoAnteriorNosTotais ? `<div><strong>Saldo Anterior:</strong> ${escapeHtml(dados.saldoAnterior || "R$ 0,00")}</div>` : ""}
        </div>
        <div>
          ${layout.osExterna ? `<div><strong>OS Externa:</strong> ${escapeHtml(osExternaResumoFatura(dados.linhas))}</div>` : ""}
          ${layout.clienteEmail ? `<div><strong>Email:</strong> ${escapeHtml(dados.clienteEmail || "—")}</div>` : ""}
          ${layout.clienteEnd ? `<div><strong>Endereço:</strong> ${escapeHtml(dados.clienteEndereco || "—")}</div>` : ""}
        </div>
      </div>`
    : `<div class="info" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid #777;padding-bottom:5px;margin-bottom:5px;line-height:1.35;font-size:${fsSmall}px">
    <div>
      ${layout.cliente ? `<strong>Cliente:</strong> ${escapeHtml(dados.clienteNome)}<br/>` : ""}
      ${layout.clienteTel ? `<strong>Telefones:</strong><br/>` : ""}
      ${layout.saldoAnterior && !saldoAnteriorNosTotais ? `<strong>Saldo Anterior:</strong> ${escapeHtml(dados.saldoAnterior || "0,00")}` : ""}
    </div>
    <div>
      ${layout.osExterna ? `<strong>OS Externa:</strong> ${escapeHtml(osExternaResumoFatura(dados.linhas))}<br/>` : ""}
      ${layout.clienteEmail ? `<strong>Email:</strong><br/>` : ""}
      ${layout.clienteEnd ? `<strong>Endereço:</strong>` : ""}
    </div>
  </div>`;

  const pixAssinatura =
    layout.pix || layout.assinatura
      ? htmlPixAssinatura(layout, fsSmall, faturaA4Smart, Boolean(layout.observacao))
      : "";

  const corpo = `<div class="page">
    ${ocultarBotaoImprimir ? "" : '<div class="actions"><button onclick="window.print()">Imprimir</button></div>'}
    <div style="position:relative;width:100%;padding-left:${faturaA4Smart ? FATURA_SMART_CONTEUDO_INSET_MM : 0}mm;padding-right:${faturaA4Smart ? FATURA_SMART_CONTEUDO_INSET_MM : 0}mm">
      ${layout.exibirBordas ? molduraHtml(layout, faturaA4Smart ? 0 : OS_REQUISICAO_PREVIEW_INSET_MM) : ""}
      ${cabecalho}
      ${faturaA4Smart ? linhaDivisoriaSmart() : '<div class="rule"></div>'}
      ${infoCliente}
      ${htmlTabelaItensA4(dados, layout, fs, faturaA4Smart, money)}
      ${faturaA4Smart ? "" : '<div class="rule-thin" style="margin-top:3px;margin-bottom:2px"></div>'}
      ${htmlTotaisA4(dados, layout, modelo, fsSmall, money)}
      ${htmlCondicaoPagamento(dados, layout, fsSmall, false, faturaA4Smart)}
      ${layout.observacao ? `<div class="obs" style="margin-top:${faturaA4Smart ? "5mm" : "10px"};font-size:${fsSmall}px"><strong>Observação:</strong> ${escapeHtml(dados.observacao || "")}</div>` : ""}
      ${layout.mensagem ? `<p style="margin-top:12px;text-align:center;font-style:italic;color:#4b5563;font-size:${fsSmall}px">${escapeHtml(layout.mensagem)}</p>` : ""}
      ${pixAssinatura}
    </div>
  </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Fatura ${dados.numeroFatura}</title>${estilosBaseA4(fs, faturaA4Smart)}</head><body>${corpo}</body></html>`;
}

function gerarHtmlFaturaTermica(
  dados: DadosFaturaImpressao,
  cfg: ConfigLaboratorio,
  layout: FaturaModeloLayout,
  modelo: ModeloFaturaId,
  money: (n: number) => string
) {
  const lab = configParaLabImpressao(cfg);
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(9, fs - 2);
  const cor = normalizarCorBorda(layout.bordas || "#000");
  const logoHtml = htmlLogo(cfg, layout, true);
  const saldoAnteriorNosTotais = modelo === "modelo5" && layout.saldoAnterior;
  const exibirItens = layout.qtd || layout.servico || layout.valorUnit || layout.desconto;
  const exibirMeta =
    layout.numOs ||
    layout.paciente ||
    layout.dentista ||
    layout.numDente ||
    layout.corDente ||
    layout.data ||
    layout.finalizado;

  const blocoTopo = `
    ${layout.data ? `<p style="text-align:right;margin:0;font-size:${fsSmall}px">${escapeHtml(dados.dataEmissao)}</p>` : ""}
    ${layout.logo ? `<div style="display:flex;justify-content:center;margin-top:${layout.logoMargemTopo}px;margin-left:${layout.logoMargemEsq}px">${logoHtml}</div>` : ""}
    ${layout.infoLab ? `<p style="text-align:center;font-weight:bold;margin:4px 0;font-size:${fs + 1}px">${escapeHtml(lab.responsavel)}</p>` : ""}
    <div style="font-size:${fsSmall}px;margin-top:8px">
      ${layout.dadosOs ? linhaRotuloValor("Fatura:", String(dados.numeroFatura)) : ""}
      ${layout.cliente ? linhaRotuloValor("Cliente:", dados.clienteNome) : ""}
      ${layout.clienteTel ? linhaRotuloValor("Telefone:", "—") : ""}
      ${layout.osExterna ? linhaRotuloValor("OS Externa:", osExternaResumoFatura(dados.linhas)) : ""}
      ${layout.clienteEmail ? linhaRotuloValor("Email:", dados.clienteEmail || "—") : ""}
      ${layout.clienteEnd ? linhaRotuloValor("Endereço:", "—") : ""}
      ${layout.ultimoPgto ? linhaRotuloValor("Última Pgto:", dados.ultimoPgto || "—") : ""}
      ${layout.saldoAnterior && !saldoAnteriorNosTotais ? linhaRotuloValor("Saldo Anterior:", dados.saldoAnterior || "0,00") : ""}
      ${layout.usuario ? linhaRotuloValor("Usuário:", dados.usuario) : ""}
    </div>`;

  const itens = exibirItens
    ? `<div style="border-top:1px solid ${cor};margin-top:8px;padding-top:4px;font-size:${fsSmall}px">
        <table>
          <thead>
            <tr style="border-bottom:1px solid ${cor}">
              ${layout.qtd ? '<th style="text-align:left;font-weight:bold;width:24px">Qtd</th>' : ""}
              ${layout.servico ? '<th style="text-align:left;font-weight:bold">Descrição</th>' : ""}
              ${layout.valorUnit ? '<th style="text-align:right;font-weight:bold;width:4.2rem">Valor Unit</th>' : ""}
              ${layout.desconto ? '<th style="text-align:right;font-weight:bold;width:3.2rem">Desc.</th>' : ""}
            </tr>
          </thead>
          <tbody>
            ${dados.linhas
              .map((linha) => {
                const metaPrazo =
                  linha.segmento === "servico" && (layout.data || layout.finalizado)
                    ? htmlMetaDatasFaturaLinha(linha, layout, "Entregue", true)
                    : "";
                const meta =
                  exibirMeta && linha.segmento === "servico"
                    ? `<tr><td colspan="4" style="padding-bottom:6px">
                      ${layout.numOs ? `<p style="margin:0">OS: <strong>${escapeHtml(linha.os)}</strong></p>` : ""}
                      ${layout.paciente || layout.dentista ? `<p style="margin:0">${layout.paciente ? `Paciente: <strong>${escapeHtml(linha.paciente)}</strong>` : ""}${layout.paciente && layout.dentista ? " " : ""}${layout.dentista ? `Dr: <strong>${escapeHtml(dados.dentista)}</strong>` : ""}</p>` : ""}
                      ${layout.numDente || layout.corDente ? `<p style="margin:0">${layout.numDente ? `Mat/Dente: <strong>${escapeHtml(linha.dentes)}</strong>` : ""}${layout.numDente && layout.corDente ? " " : ""}${layout.corDente ? `Cor Dente: <strong>${escapeHtml(linha.cor)}</strong>` : ""}</p>` : ""}
                      ${metaPrazo}
                    </td></tr>`
                    : "";
                return `<tr>
                  ${layout.qtd ? `<td style="font-weight:bold">${escapeHtml(linha.qtd)}</td>` : ""}
                  ${layout.servico ? `<td class="cel-servico">${escapeHtml(linha.servico)}</td>` : ""}
                  ${layout.valorUnit ? `<td class="right">${escapeHtml(linha.unitario)}</td>` : ""}
                  ${layout.desconto ? `<td class="right">${escapeHtml(linha.desconto)}</td>` : ""}
                </tr>${meta}`;
              })
              .join("")}
          </tbody>
        </table>
        <div style="border-top:1px solid ${cor};margin-top:6px"></div>
      </div>`
    : "";

  const totais =
    layout.totalServicos ||
    layout.descontoServicos ||
    layout.descontoFatura ||
    layout.total ||
    saldoAnteriorNosTotais
      ? `<div style="margin-top:6px;text-align:right;font-size:${fsSmall}px">
          ${layout.totalServicos ? `<p style="margin:2px 0"><strong>Total Serviços(+): </strong>${escapeHtml(money(dados.totalServicos))}</p>` : ""}
          ${saldoAnteriorNosTotais ? `<p style="margin:2px 0"><strong>Saldo Anterior(+): </strong>${escapeHtml(dados.saldoAnterior || "0,00")}</p>` : ""}
          ${layout.descontoServicos ? `<p style="margin:2px 0"><strong>Desconto Serviços(-): </strong>R$ 0,00</p>` : ""}
          ${layout.descontoFatura ? `<p style="margin:2px 0"><strong>Desconto Fatura(-): </strong>R$ ${escapeHtml(money(dados.creditoFatura))}</p>` : ""}
          ${layout.total ? `<p style="margin:2px 0;font-weight:bold"><strong>Total(=): </strong>R$ ${escapeHtml(money(dados.totalFinal))}</p>` : ""}
        </div>`
      : "";

  const rodapeLab = `<div style="margin-top:12px;text-align:center;font-size:${fsSmall}px;line-height:1.35">
    <p style="margin:0">${escapeHtml(lab.enderecoLinha1)}</p>
    <p style="margin:0">${escapeHtml((lab.enderecoLinha2 || "").replace(" / ", "/"))}</p>
    <p style="margin:0">${escapeHtml(lab.telefones)}</p>
    <p style="margin:0">email: ${escapeHtml(lab.email)}</p>
  </div>`;

  const pix = layout.pix
    ? `<div style="margin-top:16px;display:flex;flex-direction:column;align-items:center;gap:8px">
        ${
          layout.pixQrImagem?.startsWith("data:image")
            ? `<img src="${layout.pixQrImagem}" alt="QR PIX" style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;object-fit:contain" />`
            : `<div style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b7280">QR PIX</div>`
        }
        <span style="font-size:${layout.pixQrFonte}px">Pagar com PIX</span>
      </div>`
    : "";

  const corpo = `<div class="page">
    <div class="actions"><button onclick="window.print()">Imprimir</button></div>
    ${blocoTopo}
    ${itens}
    ${totais}
    ${htmlCondicaoPagamento(dados, layout, fsSmall, true)}
    ${layout.observacao ? `<p style="margin-top:8px;font-size:${fsSmall}px">Observação: <strong>${escapeHtml(dados.observacao || "—")}</strong></p>` : ""}
    ${layout.mensagem ? `<p style="margin-top:8px;text-align:center;font-style:italic;color:#4b5563;font-size:${fsSmall}px">${escapeHtml(layout.mensagem)}</p>` : ""}
    ${layout.assinatura ? `<div style="margin-top:24px;text-align:center;font-size:${fsSmall - 1}px"><p style="margin:0;text-transform:lowercase">recebi o(s) serviço(s) descrito acima</p><div style="width:192px;margin:12px auto 0;border-top:1px solid ${cor}"></div></div>` : ""}
    ${rodapeLab}
    ${pix}
  </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Fatura ${dados.numeroFatura}</title>${estilosBaseTermica(fs)}</head><body>${corpo}</body></html>`;
}

export function gerarHtmlFaturaImpressao(
  dados: DadosFaturaImpressao,
  cfgLab: ConfigLaboratorio,
  cfgFaturas: ConfiguracoesFaturas,
  opcoes: OpcoesHtmlFaturaImpressao,
  money: (n: number) => string = (n) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
) {
  const dadosImpressao: DadosFaturaImpressao = {
    ...dados,
    usuario:
      nomeUsuarioDocumentosLaboratorio(cfgLab) ||
      cabecalhoRelatorioLaboratorio(cfgLab).nome ||
      dados.usuario,
  };
  const termica = formatoPorModeloFatura(opcoes.modelo) === "termica" || opcoes.formato === "termica";
  const layout = resolverLayoutFaturaImpressao(
    cfgFaturas,
    opcoes.modelo,
    opcoes.layoutOverride
  );

  return termica
    ? gerarHtmlFaturaTermica(dadosImpressao, cfgLab, layout, opcoes.modelo, money)
    : gerarHtmlFaturaA4(
        dadosImpressao,
        cfgLab,
        layout,
        opcoes.modelo,
        money,
        opcoes.ocultarBotaoImprimir
      );
}
