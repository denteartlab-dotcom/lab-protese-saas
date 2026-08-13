export function cobrancaAsaasEditavel(status: string | null | undefined): boolean {
  const s = (status || "").toUpperCase();
  return s === "PENDING" || s === "OVERDUE";
}

export function cobrancaAsaasJaPaga(status: string | null | undefined): boolean {
  const s = (status || "").toUpperCase();
  return (
    s === "RECEIVED" ||
    s === "CONFIRMED" ||
    s === "RECEIVED_IN_CASH"
  );
}

/** 2ª via só para cobranças ainda em aberto (pendente, vencido, a vencer). */
export function cobrancaAsaasPermiteSegundaVia(
  status: string | null | undefined
): boolean {
  const s = (status || "").toUpperCase();
  if (!s) return false;
  if (cobrancaAsaasJaPaga(s)) return false;
  if (
    s === "DELETED" ||
    s === "REFUNDED" ||
    s === "REFUND_REQUESTED" ||
    s === "REFUND_IN_PROGRESS"
  ) {
    return false;
  }
  return true;
}
