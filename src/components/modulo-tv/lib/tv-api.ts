import type {
  TvChartResponse,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";
import type { ColunaKanbanId } from "@/components/modulo-tv/types";

export async function fetchTvOrdens(): Promise<TvOrdensResponse> {
  const res = await fetch("/api/tv/ordens", { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar ordens TV");
  return res.json();
}

export async function fetchTvChart(): Promise<TvChartResponse> {
  const res = await fetch("/api/tv/chart", { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar gráfico TV");
  return res.json();
}

export async function moverOrdemTv(
  id: string,
  coluna: ColunaKanbanId
): Promise<
  TvOrdensResponse & {
    ordem: TvOrdensResponse["ordens"][0] | null;
    mapaEtapas?: Record<string, number[]>;
    chaveEtapaMovida?: string;
    indiceEtapaMovida?: number;
  }
> {
  const res = await fetch(`/api/tv/ordens/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coluna }),
  });
  if (!res.ok) throw new Error("Falha ao mover OS");
  return res.json();
}
