import {
  DENTES_DECIDUOS_INFERIORES,
  DENTES_DECIDUOS_SUPERIORES,
  tipoDenticaoFromNumerosDentes,
} from "@/lib/dentes-imagens";

export const DENTES_PERMANENTES_SUPERIORES = [
  "18",
  "17",
  "16",
  "15",
  "14",
  "13",
  "12",
  "11",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
] as const;

export const DENTES_PERMANENTES_INFERIORES = [
  "48",
  "47",
  "46",
  "45",
  "44",
  "43",
  "42",
  "41",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
] as const;

function listasDenticao(tipo: "permanente" | "deciduos") {
  return tipo === "deciduos"
    ? {
        superiores: [...DENTES_DECIDUOS_SUPERIORES],
        inferiores: [...DENTES_DECIDUOS_INFERIORES],
      }
    : {
        superiores: [...DENTES_PERMANENTES_SUPERIORES],
        inferiores: [...DENTES_PERMANENTES_INFERIORES],
      };
}

/** Expande SUP/INF e retorna todos os números de dente do resumo. */
export function expandirResumoDentesOs(resumo: string): string[] {
  const texto = (resumo || "").trim();
  if (!texto || texto === "-") return [];

  const partes = texto
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
  const numerosExplicitos = partes.filter((parte) => /^\d+$/.test(parte));
  const tipo = tipoDenticaoFromNumerosDentes(numerosExplicitos);
  const { superiores, inferiores } = listasDenticao(tipo);

  return Array.from(
    new Set(
      partes.flatMap((parte) => {
        const chave = parte.toUpperCase();
        if (chave === "SUP") return superiores;
        if (chave === "INF") return inferiores;
        return /^\d+$/.test(parte) ? [parte] : [];
      })
    )
  );
}

function ordenarDentes(numeros: string[]) {
  return [...numeros].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

/** Texto completo para impressão — expande SUP/INF e lista todos os dentes. */
export function formatarDentesParaImpressaoOs(resumo: string): string {
  const numeros = expandirResumoDentesOs(resumo);
  if (!numeros.length) {
    const texto = (resumo || "").trim();
    return texto && texto !== "-" ? texto : "";
  }
  return ordenarDentes(numeros).join(", ");
}

export function mesclarResumosDentesOs(...resumos: string[]): string {
  const todos = resumos.flatMap((resumo) => expandirResumoDentesOs(resumo));
  const unicos = Array.from(new Set(todos));
  if (!unicos.length) {
    const primeiro = resumos.map((resumo) => (resumo || "").trim()).find((resumo) => resumo && resumo !== "-");
    return primeiro || "";
  }
  return ordenarDentes(unicos).join(", ");
}
