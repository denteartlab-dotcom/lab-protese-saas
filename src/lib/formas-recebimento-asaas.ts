/** Formas que geram cobrança no Asaas (Pix QR / boleto). */
export function formaExigeAsaasCobranca(forma?: string | null): boolean {
  const f = (forma || "").trim().toLowerCase();
  if (!f || f === "forma pagamento" || f === "selecione") return false;
  if (f === "pix") return true;
  if (f.includes("pix externo")) return false;
  return f.includes("boleto");
}

export type OpcaoFormaRecebimento = {
  value: string;
  label: string;
  /** Exige subconta/integração Asaas ativa. */
  exigeAsaas?: boolean;
};

/** Opções do select em Lançar Receita (OS) — ordem alinhada à UI. */
export const OPCOES_FORMA_RECEBIMENTO_OS: OpcaoFormaRecebimento[] = [
  { value: "Forma Pagamento", label: "Forma Pagamento" },
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "Pix", label: "Pix", exigeAsaas: true },
  { value: "Pix Externo", label: "Pix Externo" },
  { value: "Cartão de Crédito", label: "Cartão de Crédito" },
  { value: "Cartão de Débito", label: "Cartão de Débito" },
  { value: "Boleto Bancário", label: "Boleto Bancário", exigeAsaas: true },
  { value: "Transferência Bancária", label: "Transferência Bancária" },
];

/** Opções compactas (modal receita genérico / edição). */
export const OPCOES_FORMA_RECEBIMENTO_SIMPLES: OpcaoFormaRecebimento[] = [
  { value: "", label: "Forma Pagamento" },
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "Pix", label: "Pix", exigeAsaas: true },
  { value: "Pix Externo", label: "Pix Externo" },
  { value: "Cartão", label: "Cartão" },
  { value: "Boleto", label: "Boleto", exigeAsaas: true },
  { value: "Transferência", label: "Transferência" },
];
