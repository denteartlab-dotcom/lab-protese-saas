/** UFs brasileiras (ordem alfabética por sigla). */
export const ESTADOS_BR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type UfBrasil = (typeof ESTADOS_BR)[number];

const cacheCidades = new Map<string, string[]>();

/** Lista municípios do estado via API pública do IBGE (com cache em memória). */
export async function listarCidadesPorEstado(uf: string): Promise<string[]> {
  const sigla = uf.trim().toUpperCase();
  if (!ESTADOS_BR.includes(sigla as UfBrasil)) return [];

  const emCache = cacheCidades.get(sigla);
  if (emCache) return emCache;

  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`,
      { cache: "force-cache" }
    );
    if (!res.ok) return [];
    const dados = (await res.json()) as Array<{ nome: string }>;
    const nomes = dados.map((item) => item.nome).filter(Boolean);
    cacheCidades.set(sigla, nomes);
    return nomes;
  } catch {
    return [];
  }
}
