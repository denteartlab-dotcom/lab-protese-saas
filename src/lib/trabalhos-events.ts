/** Disparado quando uma OS/trabalho é criado ou alterado (ex.: mudança de situação). */
export const TRABALHOS_ATUALIZADOS_EVENT = "lab-trabalhos-atualizados";

const TRABALHOS_BC_CHANNEL = "lab-trabalhos-atualizados-bc";

let broadcastChannel: BroadcastChannel | null = null;

function canalBroadcastTrabalhos() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(TRABALHOS_BC_CHANNEL);
    broadcastChannel.onmessage = (ev) => {
      const detail =
        ev?.data && typeof ev.data === "object"
          ? (ev.data as { trabalhoId?: string })
          : {};
      window.dispatchEvent(
        new CustomEvent(TRABALHOS_ATUALIZADOS_EVENT, { detail })
      );
    };
  }
  return broadcastChannel;
}

if (typeof window !== "undefined") {
  canalBroadcastTrabalhos();
}

export function notificarTrabalhosAtualizados(detail?: { trabalhoId?: string }) {
  if (typeof window === "undefined") return;
  const payload = detail ?? {};
  window.dispatchEvent(
    new CustomEvent(TRABALHOS_ATUALIZADOS_EVENT, { detail: payload })
  );
  try {
    canalBroadcastTrabalhos()?.postMessage({ ts: Date.now(), ...payload });
  } catch {
    /* BroadcastChannel indisponível */
  }
}
