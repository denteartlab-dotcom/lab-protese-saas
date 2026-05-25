import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { parseBrDate } from "@/lib/datas-br";
import { formatDate } from "@/lib/utils";

export type FiltroRelatorioDespesas = {
  ordenarPor: "data_lancamento" | "nome" | "valor" | "vencimento";
  situacao: "todos" | "a_pagar" | "pagas" | "atraso";
  categoria: string;
  nome: string;
  periodoCampo: "data_lancamento" | "vencimento";
  dataInicio: string;
  dataFinal: string;
};

export type LinhaRelatorioDespesa = {
  vencimento: string;
  parcela: string;
  nome: string;
  referencia: string;
  categoria: string;
  formaPagamento: string;
  valor: number;
  conta: string;
  status: string;
  dataOrdenacao: Date;
};

type LancamentoRelatorio = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { nome: string } | null;
  trabalho?: { numeroOs: number } | null;
};

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function linhasRelatorioFromLancamentos(
  lancamentos: LancamentoRelatorio[]
): LinhaRelatorioDespesa[] {
  return lancamentos
    .filter((l) => l.tipo === "despesa")
    .map((l) => {
      const pack = desempacotarDespesa(l.descricao);
      const ref =
        l.trabalho?.numeroOs != null ? `OS ${l.trabalho.numeroOs}` : pack.referencia;
      const dataLanc = dateOnly(l.data);
      return {
        vencimento: formatDate(l.data),
        parcela: pack.parcela,
        nome: l.cliente?.nome || pack.nome,
        referencia: ref,
        categoria: pack.categoria,
        formaPagamento: l.formaPagamento || "—",
        valor: l.valor,
        conta: pack.conta,
        status: l.status,
        dataOrdenacao: dataLanc,
      };
    });
}

export function filtrarLinhasRelatorio(
  linhas: LinhaRelatorioDespesa[],
  filtro: FiltroRelatorioDespesas
) {
  const inicio = filtro.dataInicio ? parseBrDate(filtro.dataInicio) : null;
  const fim = filtro.dataFinal ? parseBrDate(filtro.dataFinal) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return linhas.filter((linha) => {
    const dataRef = linha.dataOrdenacao;
    if (inicio && dataRef < inicio) return false;
    if (fim && dataRef > fim) return false;

    if (filtro.situacao === "a_pagar" && linha.status !== "pendente") return false;
    if (filtro.situacao === "pagas" && linha.status !== "pago") return false;
    if (filtro.situacao === "atraso") {
      if (linha.status !== "pendente" || dataRef >= hoje) return false;
    }

    if (filtro.categoria !== "todos" && linha.categoria !== filtro.categoria) {
      return false;
    }
    if (filtro.nome !== "todos" && linha.nome !== filtro.nome) return false;

    return true;
  });
}

export function ordenarLinhasRelatorio(
  linhas: LinhaRelatorioDespesa[],
  ordenarPor: FiltroRelatorioDespesas["ordenarPor"]
) {
  const copia = [...linhas];
  copia.sort((a, b) => {
    if (ordenarPor === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
    if (ordenarPor === "valor") return b.valor - a.valor;
    return a.dataOrdenacao.getTime() - b.dataOrdenacao.getTime();
  });
  return copia;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function imprimirRelatorioDespesas(
  linhas: LinhaRelatorioDespesa[],
  tituloModelo: string,
  periodoLabel: string
) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const rows = linhas
    .map(
      (l) => `
    <tr>
      <td>${l.vencimento}</td>
      <td>${l.parcela}</td>
      <td>${escapeHtml(l.nome)}</td>
      <td>${escapeHtml(l.referencia)}</td>
      <td>${escapeHtml(l.categoria)}</td>
      <td>${escapeHtml(l.formaPagamento)}</td>
      <td class="num">${money(l.valor)}</td>
      <td>${escapeHtml(l.conta)}</td>
      <td>${l.status === "pago" ? "Pago" : "Pendente"}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Relatório Despesas</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #333; margin: 24px; }
    h1 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
    .meta { font-size: 10px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f6f8; font-size: 9px; text-transform: uppercase; color: #555; }
    td.num { text-align: right; }
    tfoot td { font-weight: bold; background: #fafafa; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>Relatório Despesas</h1>
  <p class="meta">${escapeHtml(tituloModelo)} · ${escapeHtml(periodoLabel)} · ${linhas.length} registro(s)</p>
  <table>
    <thead>
      <tr>
        <th>Vencimento</th>
        <th>Parc.</th>
        <th>Nome</th>
        <th>Referência</th>
        <th>Categoria</th>
        <th>Forma Pagamento</th>
        <th>Valor</th>
        <th>Conta</th>
        <th>Situação</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="9">Nenhum registro</td></tr>'}</tbody>
    <tfoot>
      <tr>
        <td colspan="6">Total</td>
        <td class="num">R$ ${money(total)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const janela = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!janela) {
    alert("Permita pop-ups para imprimir o relatório.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
