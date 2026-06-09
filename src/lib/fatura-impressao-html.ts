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
    dataEmissao: agora.toLocaleDateString("pt-BR"),
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

function estilosBaseA4(fs: number) {
  return `<style>
    @page{size:A4;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
    .page{width:${FATURA_A4_LARGURA_MM}mm;min-height:${FATURA_A4_ALTURA_MM}mm;margin:0 auto;padding:${OS_REQUISICAO_TOPO_MM}mm ${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm ${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm;font-size:${fs}px}
    .actions{text-align:right;margin-bottom:8px}
    table{border-collapse:collapse;width:100%}
    th,td{border:none;padding:2px 4px;vertical-align:top}
    .right{text-align:right}
    .center{text-align:center}
    @media print{.actions{display:none}}
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

function htmlTabelaItensA4(dados: DadosFaturaImpressao, layout: FaturaModeloLayout, fsSmall: number, fsMeta: number) {
  const colunas = [
    layout.numOs,
    layout.qtd,
    layout.servico,
    layout.numDente,
    layout.paciente,
    layout.valorUnit,
    layout.desconto,
    layout.subtotal,
  ].filter(Boolean).length;
  const exibirMeta = layout.data || layout.finalizado || layout.osExterna || layout.corDente;
  const pad = "padding-left:2.5mm;padding-right:2.5mm";

  const cabecalho = `<thead><tr>
    ${layout.numOs ? '<th style="text-align:left;font-weight:bold">OS</th>' : ""}
    ${layout.qtd ? '<th style="text-align:center;font-weight:bold">Qtd</th>' : ""}
    ${layout.servico ? '<th style="text-align:left;font-weight:bold">Serviços/Produtos</th>' : ""}
    ${layout.numDente ? '<th style="text-align:left;font-weight:bold">Num Dente</th>' : ""}
    ${layout.paciente ? '<th style="text-align:left;font-weight:bold">Paciente</th>' : ""}
    ${layout.valorUnit ? '<th style="text-align:right;font-weight:bold">Unitário</th>' : ""}
    ${layout.desconto ? '<th style="text-align:right;font-weight:bold">Desc</th>' : ""}
    ${layout.subtotal ? '<th style="text-align:right;font-weight:bold">Subtotal</th>' : ""}
  </tr></thead>`;

  const linhas = dados.linhas
    .map((linha) => {
      const meta = exibirMeta
        ? `<tr><td colspan="${colunas}" style="font-size:${fsMeta}px;padding-bottom:2px">
          ${layout.data ? `<span style="margin-right:12px">Data: <strong>${escapeHtml(linha.dataOs)}</strong></span>` : ""}
          ${layout.finalizado ? `<span style="margin-right:12px">Finalizado: <strong>${escapeHtml(linha.finalizado)}</strong></span>` : ""}
          ${layout.osExterna ? `<span style="margin-right:12px">OS Externa: <strong>${escapeHtml(linha.osExterna)}</strong></span>` : ""}
          ${layout.corDente ? `<span>Cor: <strong>${escapeHtml(linha.cor)}</strong></span>` : ""}
        </td></tr>`
        : "";
      return `<tr>
        ${layout.numOs ? `<td>${escapeHtml(linha.os)}</td>` : ""}
        ${layout.qtd ? `<td class="center">${escapeHtml(linha.qtd)}</td>` : ""}
        ${layout.servico ? `<td>${escapeHtml(linha.servico)}</td>` : ""}
        ${layout.numDente ? `<td>${escapeHtml(linha.dentes)}</td>` : ""}
        ${layout.paciente ? `<td>${escapeHtml(linha.paciente)}</td>` : ""}
        ${layout.valorUnit ? `<td class="right">${escapeHtml(linha.unitario)}</td>` : ""}
        ${layout.desconto ? `<td class="right">${escapeHtml(linha.desconto)}</td>` : ""}
        ${layout.subtotal ? `<td class="right">${escapeHtml(linha.subtotal)}</td>` : ""}
      </tr>${meta}`;
    })
    .join("");

  return `${linhaDivisoria()}
    <div style="${pad};font-size:${fsSmall}px"><table>${cabecalho}</table></div>
    ${linhaDivisoria()}
    <div style="${pad};font-size:${fsSmall}px"><table><tbody>${linhas}</tbody></table></div>
    ${linhaDivisoria()}`;
}

function htmlTotaisA4(
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  modelo: ModeloFaturaId,
  fsSmall: number,
  money: (n: number) => string
) {
  const saldoAnteriorNosTotais = modelo === "modelo3" && layout.saldoAnterior;
  const partes: string[] = [];
  if (layout.totalServicos) {
    const sinal = modelo === "modelo3" ? "(=)" : "(+)";
    partes.push(
      `<div style="display:grid;grid-template-columns:1fr 90px;padding:2px 0"><span>Total Serviços ${sinal}</span><strong style="text-align:right">${escapeHtml(money(dados.totalServicos))}</strong></div>`
    );
  }
  if (saldoAnteriorNosTotais) {
    partes.push(
      `<div style="display:grid;grid-template-columns:1fr 90px;padding:2px 0"><span>Saldo Anterior (+)</span><span style="text-align:right">R$ 0,00</span></div>`
    );
  }
  if (layout.descontoServicos) {
    partes.push(
      `<div style="display:grid;grid-template-columns:1fr 90px;padding:2px 0"><span>Desconto Serviços (-)</span><span style="text-align:right">R$ 0,00</span></div>`
    );
  }
  if (layout.descontoFatura) {
    partes.push(
      `<div style="display:grid;grid-template-columns:1fr 90px;padding:2px 0"><span>Desconto Fatura (-)</span><span style="text-align:right">R$ ${escapeHtml(money(dados.creditoFatura))}</span></div>`
    );
  }
  if (layout.total) {
    partes.push(
      `<div style="display:grid;grid-template-columns:1fr 90px;padding:2px 0;font-weight:bold"><span>Total (=)</span><strong style="text-align:right">R$ ${escapeHtml(money(dados.totalFinal))}</strong></div>`
    );
  }
  if (!partes.length) return "";
  return `<div style="margin-top:8px;margin-left:auto;width:270px;font-size:${fsSmall}px;text-align:right">${partes.join("")}</div>${linhaDivisoriaCinza()}`;
}

function htmlCondicaoPagamento(
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  fsSmall: number,
  termica: boolean
) {
  if (!layout.condicaoPagamento) return "";
  const cor = termica ? normalizarCorBorda(layout.bordas || "#000") : "#000";
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
  return `<div style="margin-top:8px;font-size:${fsSmall}px">
    <p style="font-weight:bold;margin:0 0 4px">Condição de Pagamento</p>
    <table>
      <thead>
        <tr${termica ? ` style="border-bottom:1px solid ${cor}"` : ""}>
          <th style="text-align:left;font-weight:bold">Parcela</th>
          <th style="text-align:left;font-weight:bold">Vencimento</th>
          ${layout.formaPgto ? '<th style="text-align:left;font-weight:bold">Forma Pgto</th>' : ""}
          <th style="text-align:left;font-weight:bold">Valor</th>
          ${!termica ? '<th style="text-align:left;font-weight:bold">Pago</th>' : ""}
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>${termica ? "" : linhaDivisoriaCinza()}`;
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
  layout: FaturaModeloLayout,
  modelo: ModeloFaturaId,
  money: (n: number) => string
) {
  const lab = configParaLabImpressao(cfg);
  const cab = normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao);
  const textos = montarTextosCabecalhoRequisicao(cfg, lab, cab);
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(7, fs - 2);
  const fsMeta = Math.max(9, fs - 3);
  const logoHtml = htmlLogo(cfg, layout, false);
  const saldoAnteriorNosTotais = modelo === "modelo3" && layout.saldoAnterior;

  const cabecalho = `<div style="display:flex;align-items:flex-start;gap:12px">
    ${layout.logo && logoHtml ? `<div style="flex-shrink:0">${logoHtml}</div>` : ""}
    ${
      layout.infoLab
        ? `<div style="flex:1;min-width:0;padding-top:2px">
            <p style="font-weight:bold;font-size:${fs + 1}px;margin:0;line-height:1.1">${escapeHtml(textos.nome || dados.clienteNome)}</p>
            ${textos.linhas.map((l) => `<p style="margin:0;font-size:${fsSmall}px;line-height:1.3">${escapeHtml(l)}</p>`).join("")}
          </div>`
        : '<div style="flex:1"></div>'
    }
    ${
      layout.dadosOs || layout.usuario
        ? `<div style="flex-shrink:0;text-align:right;font-size:${fsSmall}px">
            ${
              layout.dadosOs
                ? `<p style="margin:0">Fatura</p>
                   <p style="margin:0;font-weight:bold;font-size:${fs + 8}px;line-height:1">${dados.numeroFatura}</p>
                   ${layout.data ? `<p style="margin-top:4px"><span style="font-weight:bold">Data: </span>${escapeHtml(dados.dataEmissao)}</p>` : ""}`
                : ""
            }
            ${layout.usuario ? `<p><span style="font-weight:bold">Usuário: </span>${escapeHtml(dados.usuario)}</p>` : ""}
          </div>`
        : ""
    }
  </div>`;

  const infoCliente = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;font-size:${fsSmall}px;margin-top:8px">
    <div>
      ${layout.cliente ? linhaRotuloValor("Cliente:", dados.clienteNome) : ""}
      ${layout.dentista ? linhaRotuloValor("Dentista:", dados.dentista) : ""}
      ${layout.clienteTel ? linhaRotuloValor("Telefone:", "—") : ""}
      ${layout.ultimoPgto ? linhaRotuloValor("Último Pgto:", "—") : ""}
      ${layout.saldoAnterior && !saldoAnteriorNosTotais ? linhaRotuloValor("Saldo Anterior:", "R$ 0,00") : ""}
    </div>
    <div>
      ${layout.clienteEmail ? linhaRotuloValor("Email:", "—") : ""}
      ${layout.clienteEnd ? linhaRotuloValor("Endereço:", "—") : ""}
    </div>
  </div>`;

  const corpo = `<div class="page">
    <div class="actions"><button onclick="window.print()">Imprimir</button></div>
    <div style="position:relative;width:100%">
      ${molduraHtml(layout)}
      ${cabecalho}
      ${linhaDivisoria()}
      ${infoCliente}
      <div style="margin-top:8px;width:100%">${htmlTabelaItensA4(dados, layout, fsSmall, fsMeta)}</div>
      ${htmlTotaisA4(dados, layout, modelo, fsSmall, money)}
      ${htmlCondicaoPagamento(dados, layout, fsSmall, false)}
      ${layout.observacao ? `<div style="margin-top:8px;font-size:${fsSmall}px"><p><span style="font-weight:bold">Observação: </span>${escapeHtml(dados.observacao || "—")}</p></div>` : ""}
      ${layout.mensagem ? `<p style="margin-top:12px;text-align:center;font-style:italic;color:#4b5563;font-size:${fsSmall}px">${escapeHtml(layout.mensagem)}</p>` : ""}
      ${htmlPixAssinatura(layout, fsSmall)}
    </div>
  </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Fatura ${dados.numeroFatura}</title>${estilosBaseA4(fs)}</head><body>${corpo}</body></html>`;
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
    : gerarHtmlFaturaA4(dados, cfgLab, layout, opcoes.modelo, money);
}
