/** Links diretos ao abrir uma notificação (deep link). */

export function hrefFinanceiro(params: {
  clienteId?: string | null;
  lancamentoId?: string;
  acao?: "nota" | "receber" | "faturas";
  situacao?: "atraso";
}) {
  const q = new URLSearchParams();
  if (params.clienteId) q.set("clienteId", params.clienteId);
  if (params.lancamentoId) q.set("lancamentoId", params.lancamentoId);
  if (params.acao) q.set("acao", params.acao);
  if (params.situacao) q.set("situacao", params.situacao);
  const s = q.toString();
  return s ? `/app/financeiro?${s}` : "/app/financeiro";
}

export function hrefLancamentoVencido(l: {
  id: string;
  clienteId?: string | null;
  descricao: string;
}) {
  const desc = l.descricao.toLowerCase();
  const cobrancaOs = desc.includes("cobrança") || desc.includes("cobranca");
  return hrefFinanceiro({
    clienteId: l.clienteId,
    lancamentoId: l.id,
    acao: cobrancaOs ? "nota" : "receber",
    situacao: "atraso",
  });
}

export function hrefClienteSaldoLimite(clienteId: string) {
  return hrefFinanceiro({ clienteId, acao: "faturas" });
}

export function hrefClienteCobrancaDia(clienteId: string) {
  return hrefFinanceiro({ clienteId, acao: "receber" });
}

export function hrefDespesaVencendo(lancamentoId: string) {
  return `/app/financeiro?tipo=despesa&lancamentoId=${encodeURIComponent(lancamentoId)}`;
}

export function hrefBoletoControle(lancamentoId?: string) {
  const q = new URLSearchParams({ aba: "boletos" });
  if (lancamentoId) q.set("lancamentoId", lancamentoId);
  return `/app/financeiro?${q}`;
}

export function hrefOrcamento(orcamentoId: string, acao: "abrir" | "resposta" = "abrir") {
  const q = new URLSearchParams({ orcamentoId, acao });
  return `/app/orcamentos?${q}`;
}

export function hrefOrcamentoPedido(numeroPedido: number, acao: "abrir" | "resposta" = "abrir") {
  const q = new URLSearchParams({ pedido: String(numeroPedido), acao });
  return `/app/orcamentos?${q}`;
}

export function hrefProdutoEstoque(produtoId: string) {
  return `/app/produtos?produtoId=${encodeURIComponent(produtoId)}&acao=editar`;
}

export function hrefOsEditar(trabalhoId: string) {
  return `/app/producao/os?edit=${encodeURIComponent(trabalhoId)}`;
}

export function hrefOsNumero(numeroOs: number) {
  return `/app/producao/os?os=${numeroOs}`;
}

export function hrefControleServico(
  trabalhoId: string,
  painel: "vencendo" | "atrasados",
  extra?: { prazo?: string; dia?: string }
) {
  const q = new URLSearchParams({ painel, destaque: trabalhoId });
  if (extra?.prazo) q.set("prazo", extra.prazo);
  if (extra?.dia) q.set("dia", extra.dia);
  return `/app/producao/controle?${q}`;
}

export function hrefControlePainel(
  painel: "vencendo" | "atrasados",
  params?: { prazo?: string; dia?: string; imprimir?: boolean }
) {
  const q = new URLSearchParams({ painel });
  if (params?.prazo) q.set("prazo", params.prazo);
  if (params?.dia) q.set("dia", params.dia);
  if (params?.imprimir) q.set("imprimir", "1");
  return `/app/producao/controle?${q}`;
}

export function hrefOsSemNota(l: {
  trabalhoId?: string | null;
  numeroOs?: number | null;
  clienteId?: string | null;
  lancamentoId: string;
}) {
  if (l.trabalhoId) return hrefOsEditar(l.trabalhoId);
  if (l.numeroOs) return hrefOsNumero(l.numeroOs);
  return hrefFinanceiro({
    clienteId: l.clienteId,
    lancamentoId: l.lancamentoId,
    acao: "nota",
  });
}
