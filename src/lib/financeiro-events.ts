/** Disparado quando lançamentos ou contas bancárias mudam no módulo Financeiro. */
export const FINANCEIRO_ATUALIZADO_EVENT = "lab-financeiro-atualizado";

let notifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Agrupa várias alterações seguidas em um único refresh (evita tempestade de fetch). */
export function notificarFinanceiroAtualizado() {
  if (typeof window === "undefined") return;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    window.dispatchEvent(new Event(FINANCEIRO_ATUALIZADO_EVENT));
  }, 280);
}
