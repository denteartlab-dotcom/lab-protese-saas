import { carregarColaboradoresTv } from "@/lib/tv/tv-trabalhos-servidor";
import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

/** Atualiza colaboradores online no painel TV e emite via Socket.IO. */
export async function notificarPresencaTv(empresaId: string) {
  const store = getTvOrdensStore(empresaId);
  const colaboradores = await carregarColaboradoresTv(empresaId);
  store.atualizarColaboradores(colaboradores);
  store.syncBroadcast();
}
