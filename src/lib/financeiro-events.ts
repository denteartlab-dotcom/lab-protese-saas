/** Disparado quando lançamentos ou contas bancárias mudam no módulo Financeiro. */
export const FINANCEIRO_ATUALIZADO_EVENT = "lab-financeiro-atualizado";

export function notificarFinanceiroAtualizado() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FINANCEIRO_ATUALIZADO_EVENT));
}
