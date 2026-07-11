import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import { htmlCabecalhoLab, labImpressaoFromConfig } from "@/lib/lab-logo";
import { formatDate } from "@/lib/utils";

export type ModeloReciboRecebimento = "simples" | "detalhado";

export type LinhaReciboRecebimento = {
  valor: number;
  data: string;
  formaPagamento?: string | null;
  descricao?: string;
  numeroFatura: number;
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

function dataPorExtenso(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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
    .sign{width:420px;margin:70px auto 0;text-align:center;border-top:1px solid #444;padding-top:8px}
    @media print{body{padding:0}.page{max-width:none}}
  `;
}

function rodapeRecibo() {
  const labCfg = carregarConfigLaboratorio();
  const lab = labImpressaoFromConfig();
  const cidade =
    labCfg.cidade?.trim() ||
    lab.enderecoLinha2?.trim() ||
    lab.endereco?.split(",")[0]?.trim() ||
    "Governador Valadares";
  const responsavel = lab.responsavel?.trim() || labCfg.responsavel?.trim() || "";
  const cnpj = labCfg.cnpj?.trim() ? `CNPJ: ${labCfg.cnpj.trim()}` : "";

  return `
    <p class="footer">${cidade}, ${dataPorExtenso(new Date())}.</p>
    <div class="sign">${responsavel}${cnpj ? `<br/><br/>${cnpj}` : ""}</div>
  `;
}

export function gerarReciboRecebimentoHtml(
  modelo: ModeloReciboRecebimento,
  opts: {
    clienteNome: string;
    linhas: LinhaReciboRecebimento[];
  }
) {
  const total = opts.linhas.reduce((s, l) => s + l.valor, 0);
  const valorTotal = currencyBr(total);
  const lab = labImpressaoFromConfig();
  const cabecalhoRecibo = htmlCabecalhoLab(lab, { largura: 70, altura: 55 });

  const linhasTabela =
    modelo === "detalhado"
      ? opts.linhas
          .map((l) => {
            const forma = (l.formaPagamento || "Pix Externo").toUpperCase();
            const valor = currencyBr(l.valor);
            const vencimento = formatDate(l.data);
            return `
            <tr>
              <td>
                ${forma}<br/>
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

  const blocoTabela =
    modelo === "detalhado"
      ? `
        <div class="line"><strong>Referente a:</strong> Recebimento das cobranças descritas abaixo:</div>
        <table class="table">
          <thead><tr><th>Forma Pagamento</th><th>Valor</th></tr></thead>
          <tbody>${linhasTabela}</tbody>
        </table>
        <p>e para clareza firmo o presente.</p>`
      : `<div class="line"><strong>Referente a:</strong> ${referente}</div>
        <p>e para clareza firmo o presente.</p>`;

  return `<!doctype html><html><head><title>Recibo</title><style>${estilosRecibo()}</style></head><body>
    <div class="page">
      <div class="top">${cabecalhoRecibo}</div>
      <div class="title">RECIBO</div>
      <div class="amount">${valorTotal}</div>
      <div class="line"><strong>Recebi de:</strong> ${opts.clienteNome}</div>
      <div class="line"><strong>A quantia de:</strong> ${valorTotal}</div>
      ${blocoTabela}
      ${rodapeRecibo()}
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
    .map(
      (l) =>
        `Fatura ${l.numeroFatura} — ${currencyBr(l.valor)} (${formatDate(l.data)})`
    )
    .join("\n");
  return `Recibo de recebimento\nCliente: ${opts.clienteNome}\nValor total: ${currencyBr(total)}\n\n${linhasTxt}`;
}
