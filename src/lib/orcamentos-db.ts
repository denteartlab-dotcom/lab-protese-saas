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

const CHAVE_SEQ_ORCAMENTO = "numero_pedido_orcamento";

export function gerarTokenOrcamento() {
  return randomBytes(16).toString("hex");
}

export async function proximoNumeroPedido(empresaId: string) {
  const row = await prisma.sequenciaNumerica.upsert({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_SEQ_ORCAMENTO },
    },
    create: { empresaId, chave: CHAVE_SEQ_ORCAMENTO, valor: 0 },
    update: {},
  });
  const proximo = row.valor + 1;
  await prisma.sequenciaNumerica.update({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_SEQ_ORCAMENTO },
    },
    data: { valor: proximo },
  });
  return proximo;
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

export async function invalidarLinkOrcamento(id: string, empresaId?: string) {
  const where = empresaId ? { id, empresaId } : { id };
  await prisma.orcamento.updateMany({
    where,
    data: {
      linkAtivo: false,
      updatedAt: new Date(),
    },
  });
}

export { calcularTotaisItens, totalLiquidoOrcamento };
