import {
  ARMAZENAMENTO_LAB_PREFIX,
  CHAVES_ARMAZENAMENTO_LAB,
  LISTAGEM_CONFIG_PREFIX,
  LISTAGEM_CONFIGS_KEY,
  MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO,
  THEME_STORAGE_KEY_LEGADO,
} from "@/lib/armazenamento-laboratorio-keys";

const cache = new Map<string, unknown>();
let hidratado = false;
let hidratando: Promise<void> | null = null;
const filaSalvar = new Map<string, unknown>();
let timerSalvar: ReturnType<typeof setTimeout> | null = null;

export const ARMAZENAMENTO_LAB_PRONTO_EVENT = "lab-armazenamento-pronto";

export function armazenamentoLaboratorioPronto() {
  return hidratado;
}

function dispararPronto() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ARMAZENAMENTO_LAB_PRONTO_EVENT));
}

function lerLocalStorageLegado(key: string): unknown | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function removerLocalStorageLegado(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function coletarModuloProducaoEtapasLegado(): Record<string, number[]> | undefined {
  if (typeof window === "undefined") return undefined;
  const mapa: Record<string, number[]> = {};
  let achou = false;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO)) continue;
    const sufixo = key.slice(MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO.length);
    const valor = lerLocalStorageLegado(key);
    if (Array.isArray(valor)) {
      mapa[sufixo] = valor as number[];
      achou = true;
    }
    removerLocalStorageLegado(key);
  }
  return achou ? mapa : undefined;
}

function coletarListagensLegadas(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const mapa: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(LISTAGEM_CONFIG_PREFIX)) continue;
    const sufixo = key.slice(LISTAGEM_CONFIG_PREFIX.length);
    const valor = lerLocalStorageLegado(key);
    if (valor !== undefined) mapa[sufixo] = valor;
    removerLocalStorageLegado(key);
  }
  return mapa;
}

function coletarMigracaoLocal(): Record<string, unknown> {
  const entradas: Record<string, unknown> = {};

  for (const key of CHAVES_ARMAZENAMENTO_LAB) {
    if (key === LISTAGEM_CONFIGS_KEY) continue;
    const valor = lerLocalStorageLegado(key);
    if (valor !== undefined) {
      entradas[key] = valor;
      removerLocalStorageLegado(key);
    }
  }

  for (let i = 0; i < (typeof window !== "undefined" ? window.localStorage.length : 0); i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(ARMAZENAMENTO_LAB_PREFIX)) continue;
    if (key.startsWith(LISTAGEM_CONFIG_PREFIX)) continue;
    if (key in entradas) continue;
    const valor = lerLocalStorageLegado(key);
    if (valor !== undefined) {
      entradas[key] = valor;
      removerLocalStorageLegado(key);
    }
  }

  const listagens = coletarListagensLegadas();
  if (Object.keys(listagens).length > 0) {
    entradas[LISTAGEM_CONFIGS_KEY] = listagens;
  }

  const tema = lerLocalStorageLegado(THEME_STORAGE_KEY_LEGADO);
  if (tema === "dark" || tema === "light") {
    entradas.labProteseTheme = tema;
    removerLocalStorageLegado(THEME_STORAGE_KEY_LEGADO);
  }

  const etapasModulo = coletarModuloProducaoEtapasLegado();
  if (etapasModulo) {
    entradas.labProteseModuloProducaoEtapas = etapasModulo;
  }

  return entradas;
}

/** Aplica valores de limpeza/restauração no cache e persiste no servidor. */
export async function aplicarArmazenamentoLaboratorioCliente(
  keysRemover: string[],
  prefixosRemover: string[],
  valores: Record<string, unknown>
) {
  for (const [key, valor] of Object.entries(valores)) {
    gravarArmazenamentoCache(key, valor);
  }
  for (const key of keysRemover) {
    if (key in valores) continue;
    cache.delete(key);
    filaSalvar.set(key, null);
  }
  if (prefixosRemover.some((p) => p.startsWith(LISTAGEM_CONFIG_PREFIX))) {
    cache.delete(LISTAGEM_CONFIGS_KEY);
    filaSalvar.set(LISTAGEM_CONFIGS_KEY, {});
  }
  await flushSalvarPendentes();
}

const BOOTSTRAP_TIMEOUT_MS = 10_000;
const INICIALIZACAO_TIMEOUT_MS = 12_000;

async function fetchComTimeout(url: string, init?: RequestInit, timeoutMs = BOOTSTRAP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function enviarMigracaoLocal(entradas: Record<string, unknown>) {
  if (Object.keys(entradas).length === 0) return;
  try {
    await fetchComTimeout("/api/armazenamento/migrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ entradas }),
    });
  } catch {
    /* offline ou timeout */
  }
}

function aplicarBootstrap(data: Record<string, unknown>) {
  cache.clear();
  for (const [key, valor] of Object.entries(data)) {
    cache.set(key, valor);
  }
}

async function flushSalvarPendentes() {
  if (filaSalvar.size === 0) return;
  const entradas = Object.fromEntries(filaSalvar.entries());
  filaSalvar.clear();
  try {
    await fetch("/api/armazenamento/migrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ entradas, sobrescrever: true }),
    });
  } catch (err) {
    console.error("[armazenamento-laboratorio] falha ao salvar", err);
    for (const [k, v] of Object.entries(entradas)) {
      filaSalvar.set(k, v);
    }
  }
}

function agendarSalvar(key: string, valor: unknown) {
  filaSalvar.set(key, valor);
  if (timerSalvar) clearTimeout(timerSalvar);
  timerSalvar = setTimeout(() => {
    timerSalvar = null;
    void flushSalvarPendentes();
  }, 280);
}

async function carregarBootstrapServidor(legado: Record<string, unknown>) {
  try {
    const res = await fetchComTimeout("/api/armazenamento/bootstrap", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Record<string, unknown> };
      if (json.data && typeof json.data === "object") {
        aplicarBootstrap(json.data);
        return;
      }
    }
  } catch (err) {
    console.warn("[armazenamento-laboratorio] bootstrap indisponível", err);
  }
  aplicarBootstrap(legado);
}

function promessaComTimeout<T>(promessa: Promise<T>, ms: number, rotulo: string) {
  return Promise.race([
    promessa,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${rotulo} timeout`)), ms);
    }),
  ]);
}

/** Carrega dados do banco e migra resquícios do localStorage (uma vez). */
export async function inicializarArmazenamentoLaboratorio() {
  if (typeof window === "undefined") return;
  if (hidratado) return;
  if (hidratando) return hidratando;

  let legadoColetado: Record<string, unknown> = {};

  hidratando = promessaComTimeout(
    (async () => {
      legadoColetado = coletarMigracaoLocal();
      void enviarMigracaoLocal(legadoColetado);
      await carregarBootstrapServidor(legadoColetado);
    })(),
    INICIALIZACAO_TIMEOUT_MS,
    "armazenamento-init"
  )
    .catch((err) => {
      console.warn("[armazenamento-laboratorio] init com fallback", err);
      if (!hidratado) {
        aplicarBootstrap(
          Object.keys(legadoColetado).length > 0 ? legadoColetado : {}
        );
      }
    })
    .finally(() => {
      hidratado = true;
      dispararPronto();
      hidratando = null;
    });

  return hidratando;
}

/** Atualiza o cache em memória com dados mais recentes do servidor. */
export async function revalidarArmazenamentoLaboratorio() {
  if (typeof window === "undefined" || !hidratado) return;
  await carregarBootstrapServidor({});
}

export function lerArmazenamentoCache<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  return fallback;
}

export function gravarArmazenamentoCache<T>(key: string, valor: T) {
  cache.set(key, valor);
  if (typeof window !== "undefined" && hidratado) {
    agendarSalvar(key, valor);
  }
}

export async function persistirArmazenamentoImediato(key: string, valor: unknown) {
  cache.set(key, valor);
  filaSalvar.delete(key);
  await fetch("/api/armazenamento/migrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ entradas: { [key]: valor }, sobrescrever: true }),
  });
}
