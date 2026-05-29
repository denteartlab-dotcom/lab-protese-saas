/** Disparado quando uma OS/trabalho é criado ou alterado (ex.: mudança de situação). */
export const TRABALHOS_ATUALIZADOS_EVENT = "lab-trabalhos-atualizados";

export function notificarTrabalhosAtualizados(detail?: { trabalhoId?: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(TRABALHOS_ATUALIZADOS_EVENT, { detail: detail ?? {} })
  );
}
