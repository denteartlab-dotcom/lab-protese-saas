import {
  FATURA_MODELO4_LAYOUT_PADRAO,
  FATURA_MODELO5_LAYOUT_PADRAO,
  layoutFaturaModelo1Smart,
  normalizarFaturaModelo4Layout,
  normalizarFaturaModelo5Layout,
  normalizarFaturaModeloLayout,
  type FaturaModeloLayout,
} from "@/lib/fatura-modelo-layout";
import {
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

export const CONFIG_FATURAS_STORAGE_KEY = "labProteseConfiguracoesFaturas";
export const CONFIG_FATURAS_ATUALIZADA_EVENT = "lab-config-faturas-atualizada";

export type ModeloFaturaId = "modelo1" | "modelo2" | "modelo3" | "modelo4" | "modelo5";

export const MODELOS_FATURA_IDS: ModeloFaturaId[] = [
  "modelo1",
  "modelo2",
  "modelo3",
  "modelo4",
  "modelo5",
];

export const MODELOS_FATURA: Array<{ id: ModeloFaturaId; nome: string }> = [
  { id: "modelo1", nome: "Modelo Fatura 1" },
  { id: "modelo2", nome: "Modelo Fatura 2" },
  { id: "modelo3", nome: "Modelo Fatura 3" },
  {
    id: "modelo4",
    nome: "Modelo Fatura 4 - (Impressora térmica 80mm - Epson T20)",
  },
  {
    id: "modelo5",
    nome: "Modelo Fatura 5 - (Impressora térmica 80mm - Epson T20)",
  },
];

export type ConfiguracoesFaturas = {
  modeloPadrao: ModeloFaturaId;
  duasVias: Record<ModeloFaturaId, boolean>;
  layoutModelo1: FaturaModeloLayout;
  layoutModelo2: FaturaModeloLayout;
  layoutModelo3: FaturaModeloLayout;
  layoutModelo4: FaturaModeloLayout;
  layoutModelo5: FaturaModeloLayout;
};

export const CONFIG_FATURAS_PADRAO: ConfiguracoesFaturas = {
  modeloPadrao: "modelo1",
  duasVias: {
    modelo1: false,
    modelo2: false,
    modelo3: false,
    modelo4: false,
    modelo5: false,
  },
  layoutModelo1: normalizarFaturaModeloLayout(null),
  layoutModelo2: normalizarFaturaModeloLayout(null),
  layoutModelo3: normalizarFaturaModeloLayout(null),
  layoutModelo4: normalizarFaturaModelo4Layout(FATURA_MODELO4_LAYOUT_PADRAO),
  layoutModelo5: normalizarFaturaModelo5Layout(FATURA_MODELO5_LAYOUT_PADRAO),
};

export function formatoPorModeloFatura(id: ModeloFaturaId): "a4" | "termica" {
  return id === "modelo4" || id === "modelo5" ? "termica" : "a4";
}

export function layoutKeyModeloFatura(
  id: ModeloFaturaId
): keyof Pick<
  ConfiguracoesFaturas,
  | "layoutModelo1"
  | "layoutModelo2"
  | "layoutModelo3"
  | "layoutModelo4"
  | "layoutModelo5"
> {
  if (id === "modelo1") return "layoutModelo1";
  if (id === "modelo2") return "layoutModelo2";
  if (id === "modelo3") return "layoutModelo3";
  if (id === "modelo4") return "layoutModelo4";
  return "layoutModelo5";
}

export function normalizarLayoutFaturaTermica(
  id: ModeloFaturaId,
  layout?: Partial<FaturaModeloLayout> & Record<string, unknown> | null
): FaturaModeloLayout {
  return id === "modelo5"
    ? normalizarFaturaModelo5Layout(layout)
    : normalizarFaturaModelo4Layout(layout);
}

export function lerLayoutModeloFatura(
  config: ConfiguracoesFaturas,
  id: ModeloFaturaId
): FaturaModeloLayout {
  return config[layoutKeyModeloFatura(id)];
}

/** Layout A4 Smart do modelo indicado (1, 2 ou 3 — cada um com sua config salva). */
export function lerLayoutFaturaA4Compartilhado(
  config: ConfiguracoesFaturas,
  id: ModeloFaturaId
): FaturaModeloLayout {
  if (formatoPorModeloFatura(id) === "termica") {
    return lerLayoutModeloFatura(config, id);
  }
  const base = normalizarFaturaModeloLayout(config[layoutKeyModeloFatura(id)]);
  return layoutFaturaModelo1Smart(base);
}

/** Grava layout apenas no modelo editado (não sobrescreve os outros). */
export function aplicarLayoutFaturaModelo(
  config: ConfiguracoesFaturas,
  modeloId: ModeloFaturaId,
  layout: FaturaModeloLayout
): ConfiguracoesFaturas {
  const key = layoutKeyModeloFatura(modeloId);
  const norm =
    formatoPorModeloFatura(modeloId) === "termica"
      ? normalizarLayoutFaturaTermica(modeloId, layout)
      : normalizarFaturaModeloLayout(layout);
  return { ...config, [key]: norm };
}

/** @deprecated Use aplicarLayoutFaturaModelo — mantido para compatibilidade. */
export function aplicarLayoutFaturaA4Compartilhado(
  config: ConfiguracoesFaturas,
  layout: FaturaModeloLayout
): ConfiguracoesFaturas {
  return aplicarLayoutFaturaModelo(config, "modelo1", layout);
}

/** Monta config mínima para preview/impressão de um modelo. */
export function montarConfigPreviewFaturaModelo(
  modeloId: ModeloFaturaId,
  layout: FaturaModeloLayout,
  base: ConfiguracoesFaturas = CONFIG_FATURAS_PADRAO
): ConfiguracoesFaturas {
  return aplicarLayoutFaturaModelo(base, modeloId, layout);
}

export function normalizarConfiguracoesFaturas(
  valor?: Partial<ConfiguracoesFaturas> | null
): ConfiguracoesFaturas {
  if (!valor || typeof valor !== "object") {
    return {
      ...CONFIG_FATURAS_PADRAO,
      duasVias: { ...CONFIG_FATURAS_PADRAO.duasVias },
      layoutModelo1: normalizarFaturaModeloLayout(null),
      layoutModelo2: normalizarFaturaModeloLayout(null),
      layoutModelo3: normalizarFaturaModeloLayout(null),
      layoutModelo4: normalizarFaturaModelo4Layout(CONFIG_FATURAS_PADRAO.layoutModelo4),
      layoutModelo5: normalizarFaturaModelo5Layout(CONFIG_FATURAS_PADRAO.layoutModelo5),
    };
  }

  const modeloPadrao = MODELOS_FATURA_IDS.includes(valor.modeloPadrao as ModeloFaturaId)
    ? (valor.modeloPadrao as ModeloFaturaId)
    : CONFIG_FATURAS_PADRAO.modeloPadrao;

  const duasVias = { ...CONFIG_FATURAS_PADRAO.duasVias };
  if (valor.duasVias && typeof valor.duasVias === "object") {
    for (const id of MODELOS_FATURA_IDS) {
      duasVias[id] = Boolean(valor.duasVias[id]);
    }
  }

  const legadoLayouts = valor as { layouts?: Record<string, unknown> };
  const layout1 =
    valor.layoutModelo1 ??
    (legadoLayouts.layouts?.modelo1 as Partial<FaturaModeloLayout> | undefined);
  const layout2 =
    valor.layoutModelo2 ??
    (legadoLayouts.layouts?.modelo2 as Partial<FaturaModeloLayout> | undefined);
  const layout3 =
    valor.layoutModelo3 ??
    (legadoLayouts.layouts?.modelo3 as Partial<FaturaModeloLayout> | undefined);
  const layout4 =
    valor.layoutModelo4 ??
    (legadoLayouts.layouts?.modelo4 as Partial<FaturaModeloLayout> | undefined);
  const layout5 =
    valor.layoutModelo5 ??
    (legadoLayouts.layouts?.modelo5 as Partial<FaturaModeloLayout> | undefined);

  const base: ConfiguracoesFaturas = {
    modeloPadrao,
    duasVias,
    layoutModelo1: normalizarFaturaModeloLayout(layout1),
    layoutModelo2: normalizarFaturaModeloLayout(layout2),
    layoutModelo3: normalizarFaturaModeloLayout(layout3),
    layoutModelo4: normalizarFaturaModelo4Layout(
      layout4 ?? CONFIG_FATURAS_PADRAO.layoutModelo4
    ),
    layoutModelo5: normalizarFaturaModelo5Layout(
      layout5 ?? CONFIG_FATURAS_PADRAO.layoutModelo5
    ),
  };

  return base;
}

function lerConfigFaturasDoStorage(): ConfiguracoesFaturas {
  if (typeof window === "undefined") return normalizarConfiguracoesFaturas(null);
  try {
    const salvo = readStorage<Partial<ConfiguracoesFaturas> | null>(
      CONFIG_FATURAS_STORAGE_KEY,
      null
    );
    if (!salvo) return normalizarConfiguracoesFaturas(null);
    return normalizarConfiguracoesFaturas(salvo);
  } catch {
    return normalizarConfiguracoesFaturas(null);
  }
}

export function carregarConfiguracoesFaturas(): ConfiguracoesFaturas {
  return lerConfigFaturasDoStorage();
}

export function salvarConfiguracoesFaturas(config: ConfiguracoesFaturas) {
  if (typeof window === "undefined") return;
  const normalizado = normalizarConfiguracoesFaturas(config);
  writeStorage(CONFIG_FATURAS_STORAGE_KEY, normalizado);
  void persistirArmazenamentoImediato(CONFIG_FATURAS_STORAGE_KEY, normalizado);
  window.dispatchEvent(new Event(CONFIG_FATURAS_ATUALIZADA_EVENT));
}

export async function sincronizarConfiguracoesFaturasDoServidor(): Promise<ConfiguracoesFaturas> {
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_FATURAS_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return carregarConfiguracoesFaturas();
    const remoto = (await res.json()) as Partial<ConfiguracoesFaturas> | null;
    if (!remoto || typeof remoto !== "object") return carregarConfiguracoesFaturas();
    const mesclado = normalizarConfiguracoesFaturas({
      ...remoto,
      ...lerConfigFaturasDoStorage(),
    });
    salvarConfiguracoesFaturas(mesclado);
    return mesclado;
  } catch {
    return carregarConfiguracoesFaturas();
  }
}

export async function persistirConfiguracoesFaturasServidor(
  config: ConfiguracoesFaturas
): Promise<void> {
  const payload = normalizarConfiguracoesFaturas(config);
  const res = await fetch(
    `/api/json-store/${encodeURIComponent(CONFIG_FATURAS_STORAGE_KEY)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Não foi possível gravar no servidor."
    );
  }
}

export function nomeModeloFatura(id: ModeloFaturaId): string {
  return MODELOS_FATURA.find((m) => m.id === id)?.nome ?? id;
}

/** Modelos disponíveis no modal de impressão para o formato escolhido. */
export function modelosFaturaPorFormato(formato: "a4" | "termica"): ModeloFaturaId[] {
  return MODELOS_FATURA_IDS.filter((id) => formatoPorModeloFatura(id) === formato);
}

/** Modelo padrão da config, ou o primeiro do formato se o padrão for de outro formato. */
export function modeloPadraoParaFormatoFatura(
  cfg: ConfiguracoesFaturas,
  formato: "a4" | "termica"
): ModeloFaturaId {
  const lista = modelosFaturaPorFormato(formato);
  if (lista.includes(cfg.modeloPadrao)) return cfg.modeloPadrao;
  return lista[0] ?? cfg.modeloPadrao;
}
