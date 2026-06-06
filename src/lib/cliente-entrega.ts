import { configValueFromObservacoes, parseCurrencyBr } from "@/lib/cliente-financeiro";

const PREFIXO_ENTREGADOR = "Entregador:";
const PREFIXO_TIPO_ENTREGADOR = "Tipo Entregador:";
const PREFIXO_CUSTO_ENTREGA = "Custo de Entrega:";

const PREFIXOS_ENTREGA = [PREFIXO_ENTREGADOR, PREFIXO_TIPO_ENTREGADOR, PREFIXO_CUSTO_ENTREGA];

export function entregadorCliente(observacoes: string | null | undefined): string {
  return configValueFromObservacoes(observacoes, PREFIXO_ENTREGADOR);
}

export function tipoEntregadorCliente(observacoes: string | null | undefined): string {
  return configValueFromObservacoes(observacoes, PREFIXO_TIPO_ENTREGADOR);
}

export function custoEntregaCliente(observacoes: string | null | undefined): number {
  const texto = configValueFromObservacoes(observacoes, PREFIXO_CUSTO_ENTREGA);
  return parseCurrencyBr(texto || "0");
}

export function formatarCustoEntregaCliente(valor: number) {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function mesclarObservacoesComEntregaCliente(
  observacoes: string | null | undefined,
  dados: {
    entregador?: string;
    tipoEntregador?: string;
    custoEntrega?: string;
  }
) {
  const linhas = (observacoes || "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(
      (linha) =>
        linha &&
        !PREFIXOS_ENTREGA.some((prefixo) =>
          linha.toLowerCase().startsWith(prefixo.toLowerCase())
        )
    );

  const entregador = dados.entregador?.trim() || "";
  const tipoEntregador = dados.tipoEntregador?.trim() || "";
  const custoEntrega = dados.custoEntrega?.trim() || "";

  if (entregador) linhas.push(`${PREFIXO_ENTREGADOR} ${entregador}`);
  if (tipoEntregador) linhas.push(`${PREFIXO_TIPO_ENTREGADOR} ${tipoEntregador}`);
  if (custoEntrega) linhas.push(`${PREFIXO_CUSTO_ENTREGA} ${custoEntrega}`);

  return linhas.join("\n");
}
