import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  formatoPorModeloFatura,
  lerLayoutFaturaA4Compartilhado,
  lerLayoutModeloFatura,
  type ConfiguracoesFaturas,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import { parseParcelaNaDescricao, textoParcelaLog } from "@/lib/fatura-financeiro";
import {
  FATURA_A4_ALTURA_MM,
  FATURA_A4_LARGURA_MM,
  FATURA_TERMICA_LARGURA_MM,
  layoutFaturaModelo1Smart,
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
  OS_REQUISICAO_TOPO_MM,
} from "@/lib/os-modelo1-layout";

export type OpcoesHtmlFaturaImpressao = {
  formato: "a4" | "termica";
  modelo: ModeloFaturaId;
  /** Oculta o botão «Imprimir» no HTML (pré-visualização em Configurações). */
  ocultarBotaoImprimir?: boolean;
};

export type TrabalhoFaturaImpressao = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor: number;
  dentes?: string | null;
  cor?: string | null;
  instrucoes?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
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
};

export type ParcelaFaturaImpressao = {
  parcela: string;
  vencimento: string;
  forma: string;
  valor: string;
  pago: string;
};

export type DadosFaturaImpressao = {
  numeroFatura: number;
  clienteNome: string;
  dentista: string;
  observacao: string;
  dataEmissao: string;
  usuario: string;
  creditoFatura: number;
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
      return {
        servico: match[1]?.trim() || trabalho.tipoProtese,
        dentes: match[2]?.trim() || trabalho.dentes || "-",
        cor: match[3]?.trim() || trabalho.cor || "-",
        quantidade: match[4]?.trim() || "1",
        valor: parseMoney(
          line.match(
            / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
          )?.[1] || match[5] || ""
        ),
      };
    })
    .filter(Boolean) as Array<{
    servico: string;
    dentes: string;
    cor: string;
    quantidade: string;
    valor: number;
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
        },
      ];
}

export function montarDadosFaturaImpressao(params: {
  numeroFatura: number;
  clienteNome: string;
  lancamento: LancamentoFaturaImpressao;
  trabalhos: TrabalhoFaturaImpressao[];
  creditoFatura?: number;
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
      const finalizado = trabalho.dataEntrega ? formatDate(trabalho.dataEntrega) : "-";
      for (const item of itensTrabalhoFatura(trabalho)) {
        const qtd = Number(String(item.quantidade).replace(",", ".")) || 1;
        const subtotal = item.valor * qtd;
        totalServicos += subtotal;
        linhas.push({
          os: String(trabalho.numeroOs),
          osExterna: "-",
          dataOs,
          finalizado,
          cor: item.cor,
          servico: item.servico,
          dentes: item.dentes,
          paciente: trabalho.paciente?.nome?.trim() || "-",
          qtd: item.quantidade,
          unitario: money(item.valor),
          desconto: "0,00 %",
          subtotal: money(subtotal),
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
    });
  }

  const parcela = parseParcelaNaDescricao(lancamento.descricao);
  const parcelaTexto = textoParcelaLog(parcela?.numero ?? 1, parcela?.total ?? 1);
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
    linhas,
    parcelas: [
      {
        parcela: parcelaTexto,
        vencimento: formatDate(lancamento.data),
        forma: lancamento.formaPagamento || "-",
        valor: money(totalFinal),
        pago: lancamento.status === "pago" ? money(totalFinal) : money(0),
      },
    ],
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
    dataEmissao: `${a.data} 19:34`,
    usuario: a.usuario,
    creditoFatura: 0,
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

function linhaRotuloValor(rotulo: string, valor: string) {
  return `<p><span style="font-weight:bold">${escapeHtml(rotulo)} </span>${escapeHtml(valor)}</p>`;
}

function linhaDivisoria(cor = "#000") {
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  return `<div style="margin-left:-${inset}mm;margin-right:-${inset}mm;width:calc(100% + ${inset * 2}mm);border-top:${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor};box-sizing:border-box"></div>`;
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

function molduraHtml(layout: FaturaModeloLayout) {
  if (!layout.exibirBordas) return "";
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  const cor = normalizarCorBorda(layout.bordas);
  return `<div aria-hidden="true" style="position:absolute;top:-${OS_REQUISICAO_BORDA_PADDING_MM}mm;left:-${inset}mm;right:-${inset}mm;bottom:-${OS_REQUISICAO_BORDA_PADDING_MM}mm;border:${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor};pointer-events:none;box-sizing:border-box"></div>`;
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
  return `<style>
    @page{size:A4;margin:10mm 12mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:${fs}px}
    .page{width:${FATURA_A4_LARGURA_MM}mm;margin:0 auto;padding:0;min-height:auto}
    .actions{text-align:right;margin-bottom:8px}
    .rule{border-top:2px solid #111;margin:0}
    .rule-thin{border-top:1px solid #777;margin:0}
    table{border-collapse:collapse;width:100%}
    th,td{border:none;padding:2px 4px;vertical-align:top}
    .items th{font-size:8px;font-weight:bold;text-align:left;padding-bottom:4px}
    .items td{font-size:${fs}px;line-height:1.25}
    .items tr.meta-row td{padding-top:0;padding-bottom:5px}
    .items tr.meta-row td span{font-size:8px;color:#111}
    .right{text-align:right}
    .center{text-align:center}
    .totals{width:${smartModelo1 ? "248px" : "270px"};margin-left:auto;padding-top:2px}
    .totals div{display:grid;grid-template-columns:1fr 86px;padding:1px 0}
    .totals strong{font-weight:bold}
    @media print{
      .actions{display:none}
      body{padding:0;margin:0}
      .page{width:210mm;min-height:auto;height:auto;page-break-after:avoid}
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
    @media print{.actions{display:none}}
  </style>`;
}

function htmlTabelaItensA4(dados: DadosFaturaImpressao, layout: FaturaModeloLayout, fs: number) {
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
        ${layout.numOs ? `<td>${novaOs ? escapeHtml(linha.os) : ""}</td>` : ""}
        ${layout.servico ? `<td>${escapeHtml(linha.servico)}</td>` : ""}
        ${layout.numDente ? `<td>${escapeHtml(linha.dentes)}</td>` : ""}
        ${layout.paciente ? `<td>${escapeHtml(linha.paciente)}</td>` : ""}
        ${layout.qtd ? `<td class="center">${escapeHtml(linha.qtd)}</td>` : ""}
        ${layout.valorUnit ? `<td class="right">${escapeHtml(linha.unitario)}</td>` : ""}
        ${layout.desconto ? `<td class="right">% 0,00</td>` : ""}
        ${layout.subtotal ? `<td class="right">${escapeHtml(linha.subtotal)}</td>` : ""}
      </tr>`;

      if (!novaOs || !(layout.data || layout.finalizado)) return [trPrincipal];

      const metaTexto = `Data: ${escapeHtml(linha.dataOs)}${
        layout.finalizado ? ` Entregue: ${escapeHtml(linha.finalizado)}` : ""
      }`;
      const colspanMeta = layout.numOs ? Math.max(1, colunas - 1) : colunas;
      const trMeta = `<tr class="meta-row">
        ${layout.numOs ? "<td></td>" : ""}
        <td colspan="${colspanMeta}"><span>${metaTexto}</span></td>
      </tr>`;
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
      modelo === "modelo1" || modelo === "modelo2"
        ? "Total Serviços/Produtos (=)"
        : modelo === "modelo3"
          ? "Total Serviços (=)"
          : "Total Serviços (+)";
    partes.push(
      `<div><span>${rotulo}</span><strong class="right">R$ ${escapeHtml(money(dados.totalServicos))}</strong></div>`
    );
  }
  if (saldoAnteriorNosTotais) {
    partes.push(`<div><span>Saldo Anterior (+)</span><span class="right">R$ 0,00</span></div>`);
  }
  if (layout.descontoServicos) {
    partes.push(`<div><span>Desconto Serviços (-)</span><span class="right">R$ 0,00</span></div>`);
  }
  if (layout.descontoFatura) {
    partes.push(
      `<div><span>Desconto Fatura (-)</span><span class="right">R$ ${escapeHtml(money(dados.creditoFatura))}</span></div>`
    );
  }
  if (modelo === "modelo1" || modelo === "modelo2") {
    partes.push(`<div><span>Juros Fatura (+)</span><span class="right">R$ 0,00</span></div>`);
  }
  if (layout.total) {
    partes.push(
      `<div><strong>Total (=)</strong><strong class="right">R$ ${escapeHtml(money(dados.totalFinal))}</strong></div>`
    );
  }
  if (!partes.length) return "";
  return `<div class="totals" style="font-size:${fs}px;margin-top:4px">
    ${partes.join("")}
  </div>`;
}

function htmlCondicaoPagamento(
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  fsSmall: number,
  termica: boolean,
  smartModelo1 = false
) {
  if (!layout.condicaoPagamento) return "";
  const linhas = dados.parcelas
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.parcela)}</td>
        <td>${escapeHtml(p.vencimento)}</td>
        ${layout.formaPgto ? `<td>${escapeHtml(p.forma)}</td>` : ""}
        <td>${escapeHtml(p.valor)}</td>
        ${!termica ? `<td>${escapeHtml(p.pago)}</td>` : ""}
      </tr>`
    )
    .join("");
  const labelForma = smartModelo1 ? "Forma Pagto" : "Forma Pgto";
  return `<div style="margin-top:${smartModelo1 ? 10 : 18}px;font-size:${fsSmall}px">
    <p style="font-weight:bold;margin:0 0 4px">Condição de Pagamento</p>
    <table>
      <thead>
        <tr>
          <th>Parcela</th>
          <th>Vencimento</th>
          ${layout.formaPgto ? `<th>${labelForma}</th>` : ""}
          <th>Valor</th>
          ${!termica ? "<th>Pago</th>" : ""}
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>`;
}

function htmlPixAssinatura(layout: FaturaModeloLayout, fsSmall: number) {
  if (!layout.pix && !layout.assinatura) return "";
  const qr = layout.pix
    ? layout.pixQrImagem?.startsWith("data:image")
      ? `<img src="${layout.pixQrImagem}" alt="QR PIX" style="width:${layout.pixQrTamanhoPx}px;height:${layout.pixQrTamanhoPx}px;object-fit:contain" />`
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
  const layout =
    modelo === "modelo1" ? layoutFaturaModelo1Smart(layoutRaw) : layoutRaw;
  const smartModelo1 = modelo === "modelo1";
  const lab = configParaLabImpressao(cfg);
  const cab = normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao);
  const textos = montarTextosCabecalhoRequisicao(cfg, lab, cab);
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(8, fs - 1);
  const saldoAnteriorNosTotais = modelo === "modelo3" && layout.saldoAnterior;

  const cabecalho = `<div class="header" style="display:grid;grid-template-columns:1fr 132px;gap:12px;align-items:start;margin:0 0 10px">
    ${
      layout.infoLab
        ? `<div class="lab" style="line-height:1.2">
            <strong style="display:block;font-size:16px;margin-bottom:3px">${escapeHtml(textos.nome || lab.marca)}</strong>
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

  const infoCliente = `<div class="info" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid #777;padding-bottom:5px;margin-bottom:5px;line-height:1.35;font-size:${fsSmall}px">
    <div>
      ${layout.cliente ? `<strong>Cliente:</strong> ${escapeHtml(dados.clienteNome)}<br/>` : ""}
      ${layout.clienteTel ? `<strong>Telefones:</strong><br/>` : ""}
      ${layout.saldoAnterior && !saldoAnteriorNosTotais ? `<strong>Saldo Anterior:</strong> 0,00` : ""}
    </div>
    <div>
      ${layout.clienteEmail ? `<strong>Email:</strong><br/>` : ""}
      ${layout.clienteEnd ? `<strong>Endereço:</strong>` : ""}
    </div>
  </div>`;

  const pixAssinatura =
    smartModelo1 || (!layout.pix && !layout.assinatura)
      ? ""
      : htmlPixAssinatura(layout, fsSmall);

  const corpo = `<div class="page">
    ${ocultarBotaoImprimir ? "" : '<div class="actions"><button onclick="window.print()">Imprimir</button></div>'}
    <div style="position:relative;width:100%">
      ${layout.exibirBordas ? molduraHtml(layout) : ""}
      ${cabecalho}
      <div class="rule"></div>
      ${infoCliente}
      <div class="rule-thin" style="margin-bottom:3px"></div>
      ${htmlTabelaItensA4(dados, layout, fs)}
      <div class="rule-thin" style="margin-top:3px;margin-bottom:2px"></div>
      ${htmlTotaisA4(dados, layout, modelo, fsSmall, money)}
      <div class="rule-thin" style="margin-top:2px"></div>
      ${htmlCondicaoPagamento(dados, layout, fsSmall, false, smartModelo1)}
      ${smartModelo1 ? '<div class="rule-thin" style="margin-top:8px"></div>' : ""}
      ${layout.observacao ? `<div class="obs" style="margin-top:${smartModelo1 ? 8 : 10}px;font-size:${fsSmall}px"><strong>Observação:</strong> ${escapeHtml(dados.observacao || "")}</div>` : ""}
      ${layout.mensagem ? `<p style="margin-top:12px;text-align:center;font-style:italic;color:#4b5563;font-size:${fsSmall}px">${escapeHtml(layout.mensagem)}</p>` : ""}
      ${pixAssinatura}
    </div>
  </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Fatura ${dados.numeroFatura}</title>${estilosBaseA4(fs, smartModelo1)}</head><body>${corpo}</body></html>`;
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
    layout.osExterna ||
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
      ${layout.clienteEmail ? linhaRotuloValor("Email:", "—") : ""}
      ${layout.clienteEnd ? linhaRotuloValor("Endereço:", "—") : ""}
      ${layout.ultimoPgto ? linhaRotuloValor("Última Pgto:", "—") : ""}
      ${layout.saldoAnterior && !saldoAnteriorNosTotais ? linhaRotuloValor("Saldo Anterior:", "R$ 0,00") : ""}
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
                const meta = exibirMeta
                  ? `<tr><td colspan="4" style="padding-bottom:6px">
                      ${layout.numOs ? `<p style="margin:0">OS: <strong>${escapeHtml(linha.os)}</strong></p>` : ""}
                      ${layout.paciente || layout.dentista ? `<p style="margin:0">${layout.paciente ? `Paciente: <strong>${escapeHtml(linha.paciente)}</strong>` : ""}${layout.paciente && layout.dentista ? " " : ""}${layout.dentista ? `Dr: <strong>${escapeHtml(dados.dentista)}</strong>` : ""}</p>` : ""}
                      ${layout.numDente || layout.corDente ? `<p style="margin:0">${layout.numDente ? `Mat/Dente: <strong>${escapeHtml(linha.dentes)}</strong>` : ""}${layout.numDente && layout.corDente ? " " : ""}${layout.corDente ? `Cor Dente: <strong>${escapeHtml(linha.cor)}</strong>` : ""}</p>` : ""}
                      ${layout.osExterna || layout.data || layout.finalizado ? `<p style="margin:0">${layout.osExterna ? `OS Externa: <strong>${escapeHtml(linha.osExterna)}</strong> ` : ""}${layout.data ? `Data: <strong>${escapeHtml(linha.dataOs)}</strong> ` : ""}${layout.finalizado ? `Entregue: <strong>${escapeHtml(linha.finalizado)}</strong>` : ""}</p>` : ""}
                    </td></tr>`
                  : "";
                return `<tr>
                  ${layout.qtd ? `<td style="font-weight:bold">${escapeHtml(linha.qtd)}</td>` : ""}
                  ${layout.servico ? `<td>${escapeHtml(linha.servico)}</td>` : ""}
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
          ${saldoAnteriorNosTotais ? `<p style="margin:2px 0"><strong>Saldo Anterior(+): </strong>R$ 0,00</p>` : ""}
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
  const termica = formatoPorModeloFatura(opcoes.modelo) === "termica" || opcoes.formato === "termica";
  const layout = termica
    ? lerLayoutModeloFatura(cfgFaturas, opcoes.modelo)
    : lerLayoutFaturaA4Compartilhado(cfgFaturas, opcoes.modelo);

  return termica
    ? gerarHtmlFaturaTermica(dados, cfgLab, layout, opcoes.modelo, money)
    : gerarHtmlFaturaA4(
        dados,
        cfgLab,
        layout,
        opcoes.modelo,
        money,
        opcoes.ocultarBotaoImprimir
      );
}
