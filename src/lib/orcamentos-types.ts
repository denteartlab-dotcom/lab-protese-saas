export type StatusOrcamento =
  | "pendente"
  | "enviado"
  | "aguardando_resposta"
  | "aprovado"
  | "cancelado"
  | "excluido";

export type ItemOrcamento = {
  produtoId: string;
  produtoNome: string;
  marca?: string;
  codigoBarras?: string;
  imagemUrl?: string;
  quantidade: number;
  valorUnitario: number;
};

export type Orcamento = {
  id: string;
  numeroPedido: number;
  token: string;
  data: string;
  dataResposta: string | null;
  fornecedorId: string;
  fornecedorNome: string;
  status: StatusOrcamento;
  subtotal: number;
  desconto: number;
  descontoPercentual: number;
  totalLiquido: number;
  itens: ItemOrcamento[];
  observacoes: string;
  condicoesPagamento: string;
  respostaFornecedor: string;
  emailEnvio?: string;
  whatsappEnvio?: string;
  labNome: string;
  labTelefone?: string;
  labEmail?: string;
  linkAtivo: boolean;
};

export const STATUS_ORCAMENTO: Record<
  StatusOrcamento,
  { label: string; className: string }
> = {
  pendente: { label: "Pendente", className: "bg-amber-100 text-amber-800" },
  enviado: {
    label: "Enviado",
    className: "bg-blue-100 text-blue-800",
  },
  aguardando_resposta: {
    label: "Aguardando Resposta",
    className: "bg-amber-100 text-amber-800",
  },
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-800" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
  excluido: { label: "Excluído", className: "bg-red-100 text-red-700" },
};

export const STATUS_INATIVA_LINK: StatusOrcamento[] = [
  "aprovado",
  "cancelado",
  "excluido",
];

export function linkOrcamentoAtivo(status: StatusOrcamento, linkAtivo = true) {
  return linkAtivo && !STATUS_INATIVA_LINK.includes(status);
}

export function calcularTotaisItens(itens: ItemOrcamento[]) {
  return itens.reduce(
    (acc, item) => acc + item.quantidade * item.valorUnitario,
    0
  );
}

export function totalLiquidoOrcamento(
  subtotal: number,
  desconto: number,
  descontoPercentual: number
) {
  const descontoValor =
    descontoPercentual > 0
      ? subtotal * (descontoPercentual / 100)
      : desconto;
  return Math.max(subtotal - descontoValor, 0);
}
