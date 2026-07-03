/** Resultado de busca rápida de OS (issue 019). */
export type TrabalhoBuscaRapida = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor: number;
  status: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  dataEntrada?: string | null;
  dataPrevista?: string | null;
  cliente?: { id?: string; nome?: string | null } | null;
  paciente?: { id?: string; nome?: string | null } | null;
};

export async function buscarTrabalhosRapido(
  termo: string
): Promise<TrabalhoBuscaRapida[]> {
  const q = termo.trim();
  if (q.length < 1) return [];

  const response = await fetch(
    `/api/trabalhos/busca-rapida?q=${encodeURIComponent(q)}`,
    { cache: "no-store" }
  );
  if (!response.ok) return [];

  const data = (await response.json()) as { resultados?: TrabalhoBuscaRapida[] };
  return Array.isArray(data.resultados) ? data.resultados : [];
}
