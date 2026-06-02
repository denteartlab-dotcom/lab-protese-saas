import {
  normalizarOsModelo1Layout,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";

export const CONFIG_OS_STORAGE_KEY = "labProteseConfiguracoesOs";
export const CONFIG_OS_ATUALIZADA_EVENT = "lab-config-os-atualizada";

export type ModeloOsId = "modelo1" | "modelo2" | "modelo3" | "modelo4" | "modelo5";

export const MODELOS_OS_IDS: ModeloOsId[] = [
  "modelo1",
  "modelo2",
  "modelo3",
  "modelo4",
  "modelo5",
];

export const MODELOS_OS: Array<{ id: ModeloOsId; nome: string }> = [
  { id: "modelo1", nome: "Modelo 1 - (Produção)" },
  { id: "modelo2", nome: "Modelo 2 - (Produção)" },
  { id: "modelo3", nome: "Modelo 3 - (Comprovante de Entrega)" },
  {
    id: "modelo4",
    nome: "Modelo 4 - (Impressora térmica 80mm - Epson T20)",
  },
  {
    id: "modelo5",
    nome: "Modelo 5 - (Comprovante de Entrega - Impressora térmica 80mm - Epson T20)",
  },
];

export type ConfiguracoesOs = {
  modeloPadrao: ModeloOsId;
  duasVias: Record<ModeloOsId, boolean>;
  layoutModelo1: OsModelo1Layout;
};

export const CONFIG_OS_PADRAO: ConfiguracoesOs = {
  modeloPadrao: "modelo1",
  duasVias: {
    modelo1: false,
    modelo2: false,
    modelo3: false,
    modelo4: false,
    modelo5: false,
  },
  layoutModelo1: normalizarOsModelo1Layout(null),
};

export function formatoPorModeloOs(id: ModeloOsId): "a4" | "termica" {
  return id === "modelo4" || id === "modelo5" || id === "modelo3" ? "termica" : "a4";
}

export function normalizarConfiguracoesOs(
  valor?: Partial<ConfiguracoesOs> | null
): ConfiguracoesOs {
  if (!valor || typeof valor !== "object") {
    return {
      modeloPadrao: CONFIG_OS_PADRAO.modeloPadrao,
      duasVias: { ...CONFIG_OS_PADRAO.duasVias },
      layoutModelo1: normalizarOsModelo1Layout(null),
    };
  }

  const modeloPadrao = MODELOS_OS_IDS.includes(valor.modeloPadrao as ModeloOsId)
    ? (valor.modeloPadrao as ModeloOsId)
    : CONFIG_OS_PADRAO.modeloPadrao;

  const duasVias = { ...CONFIG_OS_PADRAO.duasVias };
  if (valor.duasVias && typeof valor.duasVias === "object") {
    for (const id of MODELOS_OS_IDS) {
      duasVias[id] = Boolean(valor.duasVias[id]);
    }
  }

  return {
    modeloPadrao,
    duasVias,
    layoutModelo1: normalizarOsModelo1Layout(valor.layoutModelo1),
  };
}

export function carregarLayoutModelo1(): OsModelo1Layout {
  return carregarConfiguracoesOs().layoutModelo1;
}

export function carregarConfiguracoesOs(): ConfiguracoesOs {
  if (typeof window === "undefined") return normalizarConfiguracoesOs(null);
  try {
    const raw = window.localStorage.getItem(CONFIG_OS_STORAGE_KEY);
    if (!raw) return normalizarConfiguracoesOs(null);
    return normalizarConfiguracoesOs(JSON.parse(raw) as Partial<ConfiguracoesOs>);
  } catch {
    return normalizarConfiguracoesOs(null);
  }
}

export function salvarConfiguracoesOs(config: ConfiguracoesOs) {
  if (typeof window === "undefined") return;
  const normalizado = normalizarConfiguracoesOs(config);
  window.localStorage.setItem(CONFIG_OS_STORAGE_KEY, JSON.stringify(normalizado));
  window.dispatchEvent(new Event(CONFIG_OS_ATUALIZADA_EVENT));
}

export async function sincronizarConfiguracoesOsDoServidor(): Promise<ConfiguracoesOs> {
  const local = carregarConfiguracoesOs();
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_OS_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return local;
    const remoto = (await res.json()) as Partial<ConfiguracoesOs> | null;
    if (!remoto || typeof remoto !== "object") return local;
    const mesclado = normalizarConfiguracoesOs({ ...local, ...remoto });
    salvarConfiguracoesOs(mesclado);
    return mesclado;
  } catch {
    return local;
  }
}

export async function persistirConfiguracoesOsServidor(
  config: ConfiguracoesOs
): Promise<void> {
  const payload = normalizarConfiguracoesOs(config);
  const res = await fetch(
    `/api/json-store/${encodeURIComponent(CONFIG_OS_STORAGE_KEY)}`,
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
