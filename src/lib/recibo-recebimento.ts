import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import { htmlCabecalhoLab, labImpressaoFromConfig } from "@/lib/lab-logo";
import { dadosRodapeAssinaturaRecibo } from "@/lib/recibo-assinatura-lab";
import {
  formatarQtdRecibo,
  type PacienteRecibo,
} from "@/lib/recibo-pacientes-fatura";
import { formatDate } from "@/lib/utils";

export type ModeloReciboRecebimento = "simples" | "detalhado";

export type LinhaReciboRecebimento = {
  valor: number;
  data: string;
  formaPagamento?: string | null;
  /** Referência do recebimento (ex.: Adiantamento, Pagamento parcial). */
  referencia?: string | null;
  descricao?: string;
  numeroFatura: number;
  pacientes?: PacienteRecibo[];
};

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currencyBr(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function agregarPacientesDasLinhas(linhas: LinhaReciboRecebimento[]) {
  const mapa = new Map<string, PacienteRecibo>();
  for (const linha of linhas) {
    for (const paciente of linha.pacientes || []) {
      const nome = paciente.nome.trim() || "—";
      const servico = paciente.servico?.trim() || "—";
      const chave = `${nome}\0${servico}`;
      const atual = mapa.get(chave);
      if (atual) {
        atual.quantidade += paciente.quantidade || 1;
        atual.valor += paciente.valor;
      } else {
        mapa.set(chave, {
          nome,
          servico,
          quantidade: paciente.quantidade || 1,
          valor: paciente.valor,
        });
      }
    }
  }
  return [...mapa.values()].sort(
    (a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.servico.localeCompare(b.servico, "pt-BR")
  );
}

export function dataRecebimentoDasLinhas(linhas: LinhaReciboRecebimento[]) {
  const datas = linhas.map((l) => l.data).filter(Boolean).sort();
  return datas[datas.length - 1] || "";
}

/** Forma de pagamento + referência na mesma linha (ex.: PIX EXTERNO    Adiantamento). */
export function textoFormaPagamentoRecibo(linha: LinhaReciboRecebimento) {
  const forma = (linha.formaPagamento || "Pix Externo").toUpperCase();
  const referencia = (linha.referencia || "").trim();
  if (!referencia) return forma;
  return `${forma}    ${referencia}`;
}

function estilosRecibo() {
  return `
    body{font-family:Arial,sans-serif;background:#fff;color:#111;font-size:12px;margin:0;padding:32px}
    .page{max-width:820px;margin:0 auto}
    .top{display:flex;align-items:flex-start;gap:18px;border-bottom:1px solid #222;padding-bottom:10px}
    .logo{display:flex;align-items:center;justify-content:flex-start;flex-shrink:0}
    .lab strong{display:block;font-size:14px}
    .title{text-align:center;font-size:14px;font-weight:bold;margin:18px 0}
    .amount{text-align:right;font-size:15px;font-weight:bold;margin:8px 0 32px}
    .line{margin:14px 0}
    .table{width:88%;margin:22px auto;border-collapse:collapse;font-size:11px}
    th,td{border-bottom:1px solid #e5e7eb;padding:7px;text-align:left}
    th{text-align:center;font-weight:bold}
    td{text-align:center}
    .footer{text-align:right;margin-top:26px}
    .sign{width:280px;margin:50px auto 0;text-align:center}
    .sign-img-wrap{display:flex;align-items:flex-end;justify-content:center;min-height:72px;width:100%}
    .sign-img{max-height:72px;max-width:260px;object-fit:contain;display:block;margin:0 auto}
    .sign-line{border-top:1px solid #444;width:100%;margin:0;height:0}
    .sign-name{margin-top:10px;font-size:12px}
    .sign-cnpj{margin-top:8px;font-size:11px;color:#444}
    .endereco{margin:4px 0 14px 0;color:#444;font-size:11px;line-height:1.4}
    .pacientes-title{margin:18px 0 8px;font-weight:bold}
    .table-pacientes{width:88%;margin:8px auto 0;border-collapse:collapse;font-size:11px}
    .table-pacientes th,.table-pacientes td{border-bottom:1px solid #e5e7eb;padding:7px;text-align:left}
    .table-pacientes td.valor,.table-pacientes th.valor,.table-pacientes td.qtd,.table-pacientes th.qtd{text-align:right}
    .table-pacientes .total td{font-weight:bold;border-top:1px solid #222;border-bottom:none}
    @media print{body{padding:0}.page{max-width:none}}
  `;
}

function rodapeRecibo(dataRecebimento?: string) {
  const labCfg = carregarConfigLaboratorio();
  const lab = labImpressaoFromConfig();
  const rodape = dadosRodapeAssinaturaRecibo(labCfg, lab, dataRecebimento);
  const imgAssinatura = rodape.assinaturaDataUrl
    ? `<img src="${rodape.assinaturaDataUrl}" alt="Assinatura" class="sign-img"/>`
    : "";

  return `
    <p class="footer">${rodape.cidade}, ${rodape.dataExtenso}.</p>
    <div class="sign">
      <div class="sign-img-wrap">
        ${imgAssinatura}
      </div>
      <div class="sign-line"></div>
      <div class="sign-name">${rodape.responsavel}</div>
      ${rodape.cnpj ? `<div class="sign-cnpj">${rodape.cnpj}</div>` : ""}
    </div>
  `;
}

export function gerarReciboRecebimentoHtml(
  modelo: ModeloReciboRecebimento,
  opts: {
    clienteNome: string;
    clienteEndereco?: string;
    clienteDocumento?: string;
    linhas: LinhaReciboRecebimento[];
  }
) {
  const total = opts.linhas.reduce((s, l) => s + l.valor, 0);
  const valorTotal = currencyBr(total);
  const lab = labImpressaoFromConfig();
  const cabecalhoRecibo = htmlCabecalhoLab(lab, { largura: 70, altura: 55 });
  const dataRecebimento = dataRecebimentoDasLinhas(opts.linhas);

  const linhasTabela =
    modelo === "detalhado"
      ? opts.linhas
          .map((l) => {
            const formaComReferencia = textoFormaPagamentoRecibo(l);
            const valor = currencyBr(l.valor);
            const vencimento = formatDate(l.data);
            return `
            <tr>
              <td>
                ${formaComReferencia}<br/>
                <strong>Fatura: ${l.numeroFatura}</strong> | Vencimento: ${vencimento}
              </td>
              <td>${valor}</td>
            </tr>`;
          })
          .join("")
      : "";

  const referente =
    opts.linhas.length === 1
      ? `Recebimento da fatura nº ${opts.linhas[0].numeroFatura}.`
      : `Recebimento de ${opts.linhas.length} cobranças descritas abaixo:`;

  const pacientes =
    modelo === "detalhado" ? agregarPacientesDasLinhas(opts.linhas) : [];
  const blocoPacientes =
    pacientes.length > 0
      ? `
        <div class="pacientes-title">Pacientes</div>
        <table class="table-pacientes">
          <thead><tr><th>Paciente</th><th>Serviço</th><th class="qtd">Qtd</th><th class="valor">Valor</th></tr></thead>
          <tbody>
            ${pacientes
              .map(
                (p) =>
                  `<tr><td>${escapeHtml(p.nome)}</td><td>${escapeHtml(p.servico)}</td><td class="qtd">${formatarQtdRecibo(p.quantidade)}</td><td class="valor">${currencyBr(p.valor)}</td></tr>`
              )
              .join("")}
            <tr class="total"><td colspan="3">Total</td><td class="valor">${valorTotal}</td></tr>
          </tbody>
        </table>`
      : "";

  const blocoTabela =
    modelo === "detalhado"
      ? `
        <div class="line"><strong>Referente a:</strong> Recebimento das cobranças descritas abaixo:</div>
        <table class="table">
          <thead><tr><th>Forma Pagamento</th><th>Valor</th></tr></thead>
          <tbody>${linhasTabela}</tbody>
        </table>
        ${blocoPacientes}
        <p>e para clareza firmo o presente.</p>`
      : `<div class="line"><strong>Referente a:</strong> ${referente}</div>
        <p>e para clareza firmo o presente.</p>`;

  return `<!doctype html><html><head><title>Recibo</title><style>${estilosRecibo()}</style></head><body>
    <div class="page">
      <div class="top">${cabecalhoRecibo}</div>
      <div class="title">RECIBO</div>
      <div class="amount">${valorTotal}</div>
      <div class="line"><strong>Recebi de:</strong> ${escapeHtml(opts.clienteNome)}</div>
      ${opts.clienteDocumento ? `<div class="endereco">${escapeHtml(opts.clienteDocumento)}</div>` : ""}
      ${opts.clienteEndereco ? `<div class="endereco">${escapeHtml(opts.clienteEndereco)}</div>` : ""}
      <div class="line"><strong>A quantia de:</strong> ${valorTotal}</div>
      ${blocoTabela}
      ${rodapeRecibo(dataRecebimento)}
    </div>
  </body></html>`;
}

/** @deprecated Use gerarReciboRecebimentoPdf + abrirPdfNoVisualizador */
export function abrirReciboRecebimentoImpressao(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  if (typeof window === "undefined") return;
  void import("@/lib/pdf-viewer").then(({ visualizarPdfUrl }) => {
    visualizarPdfUrl(url, "recibo.html", "Recibo", { revogarAoFechar: true });
  });
}

export function montarTextoReciboCompartilhar(opts: {
  clienteNome: string;
  linhas: LinhaReciboRecebimento[];
}) {
  const total = opts.linhas.reduce((s, l) => s + l.valor, 0);
  const linhasTxt = opts.linhas
    .map((l) => {
      const forma = textoFormaPagamentoRecibo(l);
      return `${forma} — ${currencyBr(l.valor)} (${formatDate(l.data)})`;
    })
    .join("\n");
  return `Recibo de recebimento\nCliente: ${opts.clienteNome}\nValor total: ${currencyBr(total)}\n\n${linhasTxt}`;
}
