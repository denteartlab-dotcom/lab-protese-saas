import { APP_BUILD_ID } from "@/lib/app-build-id";

export const DENTES_DECIDUOS_SUPERIORES = [
  "55",
  "54",
  "53",
  "52",
  "51",
  "61",
  "62",
  "63",
  "64",
  "65",
] as const;

export const DENTES_DECIDUOS_INFERIORES = [
  "85",
  "84",
  "83",
  "82",
  "81",
  "71",
  "72",
  "73",
  "74",
  "75",
] as const;

export const TODOS_DENTES_DECIDUOS = [
  ...DENTES_DECIDUOS_SUPERIORES,
  ...DENTES_DECIDUOS_INFERIORES,
] as const;

export type NumeroDenteDeciduo = (typeof TODOS_DENTES_DECIDUOS)[number];

const todosDeciduosLista: readonly string[] = TODOS_DENTES_DECIDUOS;

export function isDenteDeciduo(numero: string): numero is NumeroDenteDeciduo {
  return todosDeciduosLista.includes(numero);
}

export function tipoDenticaoFromNumerosDentes(valores: string[]): "permanente" | "deciduos" {
  return valores.some(isDenteDeciduo) ? "deciduos" : "permanente";
}

export function urlImagemDente(numero: string, tipoDenticao: "permanente" | "deciduos") {
  const versao = APP_BUILD_ID !== "dev" ? `?v=${APP_BUILD_ID}` : "";
  if (tipoDenticao === "deciduos") {
    return `/dentes-deciduos/dente-${numero}.png${versao}`;
  }
  return `/dentes/dente-${numero}.png${versao}`;
}
