import {
  normalizarOsModelo1Layout,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import {
  normalizarOsModelo2Layout,
  type OsModelo2Layout,
} from "@/lib/os-modelo2-layout";
import {
  normalizarOsModelo3Layout,
  type OsModelo3Layout,
} from "@/lib/os-modelo3-layout";
import {
  normalizarOsModelo4Layout,
  type OsModelo4Layout,
} from "@/lib/os-modelo4-layout";
import {
  normalizarOsModelo5Layout,
  type OsModelo5Layout,
} from "@/lib/os-modelo5-layout";
import {
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

export const CONFIG_OS_STORAGE_KEY = "labProteseConfiguracoesOs";
export const CONFIG_OS_ATUALIZADA_EVENT = "lab-config-os-atualizada";

/** Migração única: modelos A4 1–3 sem moldura até o usuário marcar “Bordas”. */
const MIGRATION_BORDA_DESLIGADA_KEY = "labProteseOsBordaDesligada_v3";

function desligarBordaModelosA4(cfg: ConfiguracoesOs): ConfiguracoesOs {
  return {
    ...cfg,
    layoutModelo1: { ...cfg.layoutModelo1, exibirBordas: false },
    layoutModelo2: { ...cfg.layoutModelo2, exibirBordas: false },
    layoutModelo3: { ...cfg.layoutModelo3, exibirBordas: false },
  };
}

/** Aplica padrão sem borda nos modelos 1, 2 e 3 (uma vez por navegador). */
export function aplicarMigracaoBordaDesligadaModelos123(
  cfg: ConfiguracoesOs
): { config: ConfiguracoesOs; alterou: boolean } {
  if (typeof window === "undefined") {
    return { config: cfg, alterou: false };
  }
  if (readStorage<string | null>(MIGRATION_BORDA_DESLIGADA_KEY, null) === "1") {
    return { config: cfg, alterou: false };
  }
  writeStorage(MIGRATION_BORDA_DESLIGADA_KEY, "1");
  return { config: desligarBordaModelosA4(cfg), alterou: true };
}

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

export const ROTAS_MODELO_OS: Record<ModeloOsId, string> = {
  modelo1: "/app/configuracoes/os/modelo1",
  modelo2: "/app/configuracoes/os/modelo2",
  modelo3: "/app/configuracoes/os/modelo3",
  modelo4: "/app/configuracoes/os/modelo4",
  modelo5: "/app/configuracoes/os/modelo5",
};

export type ConfiguracoesOs = {
  modeloPadrao: ModeloOsId;
  duasVias: Record<ModeloOsId, boolean>;
  layoutModelo1: OsModelo1Layout;
  layoutModelo2: OsModelo2Layout;
  layoutModelo3: OsModelo3Layout;
  layoutModelo4: OsModelo4Layout;
  layoutModelo5: OsModelo5Layout;
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
  layoutModelo2: normalizarOsModelo2Layout(null),
  layoutModelo3: normalizarOsModelo3Layout(null),
  layoutModelo4: normalizarOsModelo4Layout(null),
  layoutModelo5: normalizarOsModelo5Layout(null),
};

export function formatoPorModeloOs(id: ModeloOsId): "a4" | "termica" {
  return id === "modelo4" || id === "modelo5" ? "termica" : "a4";
}

export function nomeModeloOs(id: ModeloOsId): string {
  return MODELOS_OS.find((m) => m.id === id)?.nome ?? id;
}

/** Modelos disponíveis no modal de impressão para o formato escolhido. */
export function modelosOsPorFormato(formato: "a4" | "termica"): ModeloOsId[] {
  return MODELOS_OS_IDS.filter((id) => formatoPorModeloOs(id) === formato);
}

/** Modelo padrão da config, ou o primeiro do formato se o padrão for de outro formato. */
export function modeloPadraoParaFormato(
  cfg: ConfiguracoesOs,
  formato: "a4" | "termica"
): ModeloOsId {
  const lista = modelosOsPorFormato(formato);
  if (lista.includes(cfg.modeloPadrao)) return cfg.modeloPadrao;
  return lista[0] ?? cfg.modeloPadrao;
}

export function normalizarConfiguracoesOs(
  valor?: Partial<ConfiguracoesOs> | null
): ConfiguracoesOs {
  if (!valor || typeof valor !== "object") {
    return {
      modeloPadrao: CONFIG_OS_PADRAO.modeloPadrao,
      duasVias: { ...CONFIG_OS_PADRAO.duasVias },
      layoutModelo1: normalizarOsModelo1Layout(null),
      layoutModelo2: normalizarOsModelo2Layout(null),
      layoutModelo3: normalizarOsModelo3Layout(null),
      layoutModelo4: normalizarOsModelo4Layout(null),
      layoutModelo5: normalizarOsModelo5Layout(null),
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
    layoutModelo2: normalizarOsModelo2Layout(valor.layoutModelo2),
    layoutModelo3: normalizarOsModelo3Layout(valor.layoutModelo3),
    layoutModelo4: normalizarOsModelo4Layout(valor.layoutModelo4),
    layoutModelo5: normalizarOsModelo5Layout(valor.layoutModelo5),
  };
}

export function carregarLayoutModelo5(): OsModelo5Layout {
  return carregarConfiguracoesOs().layoutModelo5;
}

export function carregarLayoutModelo4(): OsModelo4Layout {
  return carregarConfiguracoesOs().layoutModelo4;
}

export function carregarLayoutModelo3(): OsModelo3Layout {
  return carregarConfiguracoesOs().layoutModelo3;
}

export function carregarLayoutModelo2(): OsModelo2Layout {
  return carregarConfiguracoesOs().layoutModelo2;
}

export function carregarLayoutModelo1(): OsModelo1Layout {
  return carregarConfiguracoesOs().layoutModelo1;
}

function lerConfigOsDoStorage(): ConfiguracoesOs {
  if (typeof window === "undefined") return normalizarConfiguracoesOs(null);
  try {
    const salvo = readStorage<Partial<ConfiguracoesOs> | null>(CONFIG_OS_STORAGE_KEY, null);
    if (!salvo) return normalizarConfiguracoesOs(null);
    return normalizarConfiguracoesOs(salvo);
  } catch {
    return normalizarConfiguracoesOs(null);
  }
}

export function carregarConfiguracoesOs(): ConfiguracoesOs {
  if (typeof window === "undefined") return normalizarConfiguracoesOs(null);
  const base = lerConfigOsDoStorage();
  const { config, alterou } = aplicarMigracaoBordaDesligadaModelos123(base);
  if (alterou) {
    writeStorage(CONFIG_OS_STORAGE_KEY, config);
    void persistirConfiguracoesOsServidor(config).catch(() => undefined);
  }
  return config;
}

export function salvarConfiguracoesOs(config: ConfiguracoesOs) {
  if (typeof window === "undefined") return;
  const normalizado = normalizarConfiguracoesOs(config);
  writeStorage(CONFIG_OS_STORAGE_KEY, normalizado);
  void persistirArmazenamentoImediato(CONFIG_OS_STORAGE_KEY, normalizado);
  window.dispatchEvent(new Event(CONFIG_OS_ATUALIZADA_EVENT));
}

export async function sincronizarConfiguracoesOsDoServidor(): Promise<ConfiguracoesOs> {
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_OS_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return carregarConfiguracoesOs();
    const remoto = (await res.json()) as Partial<ConfiguracoesOs> | null;
    if (!remoto || typeof remoto !== "object") return carregarConfiguracoesOs();
    /** Local por último: lê após o fetch para não sobrescrever cliques recentes. */
    const mesclado = normalizarConfiguracoesOs({
      ...remoto,
      ...lerConfigOsDoStorage(),
    });
    const { config, alterou } = aplicarMigracaoBordaDesligadaModelos123(mesclado);
    salvarConfiguracoesOs(config);
    if (alterou) {
      await persistirConfiguracoesOsServidor(config).catch(() => undefined);
    }
    return config;
  } catch {
    return carregarConfiguracoesOs();
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
