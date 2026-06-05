import {
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

export const CONFIG_ETIQUETAS_STORAGE_KEY = "labProteseConfiguracoesEtiquetas";
export const CONFIG_ETIQUETAS_ATUALIZADA_EVENT = "lab-config-etiquetas-atualizada";

export type ModeloEtiquetaId = "slk-54x101" | "2rle-36x89" | "2rlh-28x89" | "mrl-20x51";

export const MODELOS_ETIQUETA_IDS: ModeloEtiquetaId[] = [
  "slk-54x101",
  "2rle-36x89",
  "2rlh-28x89",
  "mrl-20x51",
];

export const MODELOS_ETIQUETA: Array<{
  id: ModeloEtiquetaId;
  nome: string;
  larguraMm: number;
  alturaMm: number;
}> = [
  { id: "slk-54x101", nome: "SLP SLR 54mm x 101mm", larguraMm: 54, alturaMm: 101 },
  { id: "2rle-36x89", nome: "SLP 2RLE 36mm x 89mm", larguraMm: 36, alturaMm: 89 },
  { id: "2rlh-28x89", nome: "SLP 2RLH 28mm x 89mm", larguraMm: 28, alturaMm: 89 },
  { id: "mrl-20x51", nome: "SLP MRL 20mm x 51mm", larguraMm: 20, alturaMm: 51 },
];

export type ConfiguracoesEtiquetas = {
  modeloPadrao: ModeloEtiquetaId;
  duasVias: Record<ModeloEtiquetaId, boolean>;
};

export const CONFIG_ETIQUETAS_PADRAO: ConfiguracoesEtiquetas = {
  modeloPadrao: "slk-54x101",
  duasVias: {
    "slk-54x101": false,
    "2rle-36x89": false,
    "2rlh-28x89": false,
    "mrl-20x51": false,
  },
};

export function modeloEtiquetaValido(id: string): id is ModeloEtiquetaId {
  return MODELOS_ETIQUETA_IDS.includes(id as ModeloEtiquetaId);
}

export function nomeModeloEtiqueta(id: ModeloEtiquetaId): string {
  return MODELOS_ETIQUETA.find((m) => m.id === id)?.nome ?? id;
}

export function dimensoesModeloEtiqueta(id: ModeloEtiquetaId) {
  const modelo = MODELOS_ETIQUETA.find((m) => m.id === id);
  return {
    larguraMm: modelo?.larguraMm ?? 54,
    alturaMm: modelo?.alturaMm ?? 101,
  };
}

export function normalizarConfiguracoesEtiquetas(
  valor?: Partial<ConfiguracoesEtiquetas> | null
): ConfiguracoesEtiquetas {
  if (!valor || typeof valor !== "object") {
    return {
      ...CONFIG_ETIQUETAS_PADRAO,
      duasVias: { ...CONFIG_ETIQUETAS_PADRAO.duasVias },
    };
  }

  const modeloPadrao: ModeloEtiquetaId = modeloEtiquetaValido(valor.modeloPadrao ?? "")
    ? (valor.modeloPadrao as ModeloEtiquetaId)
    : CONFIG_ETIQUETAS_PADRAO.modeloPadrao;

  const duasVias = { ...CONFIG_ETIQUETAS_PADRAO.duasVias };
  if (valor.duasVias && typeof valor.duasVias === "object") {
    for (const id of MODELOS_ETIQUETA_IDS) {
      duasVias[id] = Boolean(valor.duasVias[id]);
    }
  }

  return { modeloPadrao, duasVias };
}

function lerConfigEtiquetasDoStorage(): ConfiguracoesEtiquetas {
  if (typeof window === "undefined") return normalizarConfiguracoesEtiquetas(null);
  try {
    const salvo = readStorage<Partial<ConfiguracoesEtiquetas> | null>(
      CONFIG_ETIQUETAS_STORAGE_KEY,
      null
    );
    if (!salvo) return normalizarConfiguracoesEtiquetas(null);
    return normalizarConfiguracoesEtiquetas(salvo);
  } catch {
    return normalizarConfiguracoesEtiquetas(null);
  }
}

export function carregarConfiguracoesEtiquetas(): ConfiguracoesEtiquetas {
  return lerConfigEtiquetasDoStorage();
}

export function salvarConfiguracoesEtiquetas(config: ConfiguracoesEtiquetas) {
  if (typeof window === "undefined") return;
  const normalizado = normalizarConfiguracoesEtiquetas(config);
  writeStorage(CONFIG_ETIQUETAS_STORAGE_KEY, normalizado);
  void persistirArmazenamentoImediato(CONFIG_ETIQUETAS_STORAGE_KEY, normalizado);
  window.dispatchEvent(new Event(CONFIG_ETIQUETAS_ATUALIZADA_EVENT));
}

export async function sincronizarConfiguracoesEtiquetasDoServidor(): Promise<ConfiguracoesEtiquetas> {
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_ETIQUETAS_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return carregarConfiguracoesEtiquetas();
    const remoto = (await res.json()) as Partial<ConfiguracoesEtiquetas> | null;
    if (!remoto || typeof remoto !== "object") return carregarConfiguracoesEtiquetas();
    const mesclado = normalizarConfiguracoesEtiquetas({
      ...remoto,
      ...lerConfigEtiquetasDoStorage(),
    });
    salvarConfiguracoesEtiquetas(mesclado);
    return mesclado;
  } catch {
    return carregarConfiguracoesEtiquetas();
  }
}

export async function persistirConfiguracoesEtiquetasServidor(
  config: ConfiguracoesEtiquetas
): Promise<void> {
  const payload = normalizarConfiguracoesEtiquetas(config);
  const res = await fetch(
    `/api/json-store/${encodeURIComponent(CONFIG_ETIQUETAS_STORAGE_KEY)}`,
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

export function modeloPadraoEtiqueta(cfg: ConfiguracoesEtiquetas): ModeloEtiquetaId {
  return cfg.modeloPadrao;
}
