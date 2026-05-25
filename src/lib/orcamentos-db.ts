import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  calcularTotaisItens,
  linkOrcamentoAtivo,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type Orcamento,
  type StatusOrcamento,
} from "@/lib/orcamentos-types";

type OrcamentoRow = {
  id: string;
  numeroPedido: number;
  token: string;
  data: Date;
  dataResposta: Date | null;
  fornecedorId: string | null;
  fornecedorNome: string;
  status: string;
  subtotal: number;
  desconto: number;
  descontoPercentual: number;
  totalLiquido: number;
  observacoes: string | null;
  condicoesPagamento: string | null;
  respostaFornecedor: string | null;
  emailEnvio: string | null;
  whatsappEnvio: string | null;
  labNome: string;
  labTelefone: string | null;
  labEmail: string | null;
  itensJson: string;
  linkAtivo: boolean;
};

export function gerarTokenOrcamento() {
  return randomBytes(16).toString("hex");
}

export async function proximoNumeroPedido() {
  const last = await prisma.orcamento.findFirst({
    orderBy: { numeroPedido: "desc" },
    select: { numeroPedido: true },
  });
  return (last?.numeroPedido ?? 0) + 1;
}

function parseItens(json: string): ItemOrcamento[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapOrcamento(row: OrcamentoRow): Orcamento {
  return {
    id: row.id,
    numeroPedido: row.numeroPedido,
    token: row.token,
    data: row.data.toISOString().slice(0, 10),
    dataResposta: row.dataResposta
      ? row.dataResposta.toISOString().slice(0, 10)
      : null,
    fornecedorId: row.fornecedorId || "",
    fornecedorNome: row.fornecedorNome,
    status: row.status as StatusOrcamento,
    subtotal: row.subtotal,
    desconto: row.desconto,
    descontoPercentual: row.descontoPercentual,
    totalLiquido: row.totalLiquido,
    itens: parseItens(row.itensJson),
    observacoes: row.observacoes || "",
    condicoesPagamento: row.condicoesPagamento || "",
    respostaFornecedor: row.respostaFornecedor || "",
    emailEnvio: row.emailEnvio || undefined,
    whatsappEnvio: row.whatsappEnvio || undefined,
    labNome: row.labNome,
    labTelefone: row.labTelefone || undefined,
    labEmail: row.labEmail || undefined,
    linkAtivo: row.linkAtivo,
  };
}

export function statusInvalidaLink(status: StatusOrcamento) {
  return !linkOrcamentoAtivo(status, true);
}

export async function invalidarLinkOrcamento(id: string) {
  await prisma.orcamento.update({
    where: { id },
    data: {
      linkAtivo: false,
      updatedAt: new Date(),
    },
  });
}

export { calcularTotaisItens, totalLiquidoOrcamento };
