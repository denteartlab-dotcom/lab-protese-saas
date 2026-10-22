import {
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";
import type { FormatoEtiquetaEnvio, ModeloEtiquetaA4 } from "@/lib/etiqueta-envio-entrega";

export const CONFIG_ETIQUETA_ENTREGA_STORAGE_KEY = "labProteseConfigEtiquetaEntrega";
export const CONFIG_ETIQUETA_ENTREGA_ATUALIZADA_EVENT = "lab-config-etiqueta-entrega-atualizada";

export type ModeloEtiquetaEntregaId = "modelo1" | "modelo2" | "modelo3" | "modelo4";

export const MODELOS_ETIQUETA_ENTREGA_IDS: ModeloEtiquetaEntregaId[] = [
  "modelo1",
  "modelo2",
  "modelo3",
  "modelo4",
];

export const MODELOS_ETIQUETA_ENTREGA: Array<{
  id: ModeloEtiquetaEntregaId;
  nome: string;
  formato: FormatoEtiquetaEnvio;
  modeloA4: ModeloEtiquetaA4;
}> = [
  { id: "modelo1", nome: "Modelo 1 - (Folha A4 inteira)", formato: "a4", modeloA4: "modelo1" },
  { id: "modelo2", nome: "Modelo 2 - (Duas etiquetas na folha A4)", formato: "a4", modeloA4: "modelo2" },
  { id: "modelo3", nome: "Modelo 3 - (Térmica 80mm)", formato: "termica", modeloA4: "modelo1" },
  { id: "modelo4", nome: "Modelo 4 - (Etiqueta 100×150 mm)", formato: "etiqueta", modeloA4: "modelo1" },
];

export const ROTAS_ETIQUETA_ENTREGA: Record<ModeloEtiquetaEntregaId, string> = {
  modelo1: "/app/configuracoes/etiquetas-entrega/modelo1",
  modelo2: "/app/configuracoes/etiquetas-entrega/modelo2",
  modelo3: "/app/configuracoes/etiquetas-entrega/modelo3",
  modelo4: "/app/configuracoes/etiquetas-entrega/modelo4",
};

export type LayoutEtiquetaEntrega = {
  exibirOs: boolean;
  exibirDestinatario: boolean;
  exibirRemetente: boolean;
  exibirCep: boolean;
  exibirTelefone: boolean;
  exibirBorda: boolean;
  tamanhoFonte: number;
};

export type ConfiguracoesEtiquetaEntrega = {
  modeloPadrao: ModeloEtiquetaEntregaId;
  duasVias: Record<ModeloEtiquetaEntregaId, boolean>;
  layouts: Record<ModeloEtiquetaEntregaId, LayoutEtiquetaEntrega>;
};

export const LAYOUT_ETIQUETA_ENTREGA_PADRAO: LayoutEtiquetaEntrega = {
  exibirOs: true,
  exibirDestinatario: true,
  exibirRemetente: true,
  exibirCep: true,
  exibirTelefone: true,
  exibirBorda: true,
  tamanhoFonte: 14,
};

function layoutsPadrao(): Record<ModeloEtiquetaEntregaId, LayoutEtiquetaEntrega> {
  return {
    modelo1: { ...LAYOUT_ETIQUETA_ENTREGA_PADRAO },
    modelo2: { ...LAYOUT_ETIQUETA_ENTREGA_PADRAO },
    modelo3: { ...LAYOUT_ETIQUETA_ENTREGA_PADRAO },
    modelo4: { ...LAYOUT_ETIQUETA_ENTREGA_PADRAO },
  };
}

export const CONFIG_ETIQUETA_ENTREGA_PADRAO: ConfiguracoesEtiquetaEntrega = {
  modeloPadrao: "modelo1",
  duasVias: { modelo1: false, modelo2: false, modelo3: false, modelo4: false },
  layouts: layoutsPadrao(),
};

export function modeloEtiquetaEntregaValido(id: string): id is ModeloEtiquetaEntregaId {
  return MODELOS_ETIQUETA_ENTREGA_IDS.includes(id as ModeloEtiquetaEntregaId);
}

export function modeloEtiquetaEntregaPorId(id: ModeloEtiquetaEntregaId) {
  return MODELOS_ETIQUETA_ENTREGA.find((modelo) => modelo.id === id) ?? MODELOS_ETIQUETA_ENTREGA[0];
}

export function normalizarLayoutEtiquetaEntrega(
  valor?: Partial<LayoutEtiquetaEntrega> | null
): LayoutEtiquetaEntrega {
  const base = { ...LAYOUT_ETIQUETA_ENTREGA_PADRAO };
  if (!valor || typeof valor !== "object") return base;
  const fonte = Math.round(Number(valor.tamanhoFonte));
  return {
    exibirOs: valor.exibirOs !== false,
    exibirDestinatario: valor.exibirDestinatario !== false,
    exibirRemetente: valor.exibirRemetente !== false,
    exibirCep: valor.exibirCep !== false,
    exibirTelefone: valor.exibirTelefone !== false,
    exibirBorda: valor.exibirBorda !== false,
    tamanhoFonte: Number.isFinite(fonte) ? Math.min(22, Math.max(10, fonte)) : base.tamanhoFonte,
  };
}

export function normalizarConfiguracoesEtiquetaEntrega(
  valor?: Partial<ConfiguracoesEtiquetaEntrega> | null
): ConfiguracoesEtiquetaEntrega {
  if (!valor || typeof valor !== "object") {
    return {
      modeloPadrao: CONFIG_ETIQUETA_ENTREGA_PADRAO.modeloPadrao,
      duasVias: { ...CONFIG_ETIQUETA_ENTREGA_PADRAO.duasVias },
      layouts: layoutsPadrao(),
    };
  }
  const modeloPadrao = modeloEtiquetaEntregaValido(String(valor.modeloPadrao || ""))
    ? (valor.modeloPadrao as ModeloEtiquetaEntregaId)
    : CONFIG_ETIQUETA_ENTREGA_PADRAO.modeloPadrao;
  const duasVias = { ...CONFIG_ETIQUETA_ENTREGA_PADRAO.duasVias };
  if (valor.duasVias && typeof valor.duasVias === "object") {
    for (const id of MODELOS_ETIQUETA_ENTREGA_IDS) {
      duasVias[id] = Boolean(valor.duasVias[id]);
    }
  }
  const layouts = layoutsPadrao();
  if (valor.layouts && typeof valor.layouts === "object") {
    for (const id of MODELOS_ETIQUETA_ENTREGA_IDS) {
      layouts[id] = normalizarLayoutEtiquetaEntrega(valor.layouts[id]);
    }
  }
  return { modeloPadrao, duasVias, layouts };
}

function lerDoStorage(): ConfiguracoesEtiquetaEntrega {
  if (typeof window === "undefined") return normalizarConfiguracoesEtiquetaEntrega(null);
  try {
    const salvo = readStorage<Partial<ConfiguracoesEtiquetaEntrega> | null>(
      CONFIG_ETIQUETA_ENTREGA_STORAGE_KEY,
      null
    );
    return normalizarConfiguracoesEtiquetaEntrega(salvo);
  } catch {
    return normalizarConfiguracoesEtiquetaEntrega(null);
  }
}

export function carregarConfiguracoesEtiquetaEntrega(): ConfiguracoesEtiquetaEntrega {
  return lerDoStorage();
}

export function salvarConfiguracoesEtiquetaEntrega(config: ConfiguracoesEtiquetaEntrega) {
  if (typeof window === "undefined") return;
  const normalizado = normalizarConfiguracoesEtiquetaEntrega(config);
  writeStorage(CONFIG_ETIQUETA_ENTREGA_STORAGE_KEY, normalizado);
  void persistirArmazenamentoImediato(CONFIG_ETIQUETA_ENTREGA_STORAGE_KEY, normalizado);
  window.dispatchEvent(new Event(CONFIG_ETIQUETA_ENTREGA_ATUALIZADA_EVENT));
}

export async function sincronizarConfiguracoesEtiquetaEntregaDoServidor(): Promise<ConfiguracoesEtiquetaEntrega> {
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_ETIQUETA_ENTREGA_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return carregarConfiguracoesEtiquetaEntrega();
    const remoto = (await res.json()) as Partial<ConfiguracoesEtiquetaEntrega> | null;
    if (!remoto || typeof remoto !== "object") return carregarConfiguracoesEtiquetaEntrega();
    const mesclado = normalizarConfiguracoesEtiquetaEntrega({
      ...remoto,
      ...lerDoStorage(),
    });
    salvarConfiguracoesEtiquetaEntrega(mesclado);
    return mesclado;
  } catch {
    return carregarConfiguracoesEtiquetaEntrega();
  }
}

export async function persistirConfiguracoesEtiquetaEntregaServidor(
  config: ConfiguracoesEtiquetaEntrega
): Promise<void> {
  const payload = normalizarConfiguracoesEtiquetaEntrega(config);
  const res = await fetch(
    `/api/json-store/${encodeURIComponent(CONFIG_ETIQUETA_ENTREGA_STORAGE_KEY)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Não foi possível gravar no servidor.");
  }
}
