/** Disparado quando lançamentos ou contas bancárias mudam no módulo Financeiro. */
export const FINANCEIRO_ATUALIZADO_EVENT = "lab-financeiro-atualizado";

const FINANCEIRO_BC_CHANNEL = "lab-financeiro-atualizado-bc";

let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

function dispararFinanceiroAtualizado() {
  window.dispatchEvent(new Event(FINANCEIRO_ATUALIZADO_EVENT));
}

function canalBroadcastFinanceiro() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(FINANCEIRO_BC_CHANNEL);
    broadcastChannel.onmessage = () => dispararFinanceiroAtualizado();
  }
  return broadcastChannel;
}

if (typeof window !== "undefined") {
  canalBroadcastFinanceiro();
}

/** Agrupa várias alterações seguidas em um único refresh (evita tempestade de fetch). */
export function notificarFinanceiroAtualizado() {
  if (typeof window === "undefined") return;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    dispararFinanceiroAtualizado();
    try {
      canalBroadcastFinanceiro()?.postMessage({ ts: Date.now() });
    } catch {
      /* BroadcastChannel indisponível */
    }
  }, 280);
}
