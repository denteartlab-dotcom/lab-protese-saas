import {
  ARMAZENAMENTO_LAB_PREFIX,
  CHAVES_ARMAZENAMENTO_LAB,
  LISTAGEM_CONFIG_PREFIX,
  LISTAGEM_CONFIGS_KEY,
  MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO,
  THEME_STORAGE_KEY_LEGADO,
} from "@/lib/armazenamento-laboratorio-keys";

const cache = new Map<string, unknown>();
const chavesDoServidor = new Set<string>();
const snapshotServidor = new Map<string, string>();
let hidratado = false;
let bootstrapOk = false;
let hidratando: Promise<void> | null = null;
const filaSalvar = new Map<string, unknown>();
let timerSalvar: ReturnType<typeof setTimeout> | null = null;

export const ARMAZENAMENTO_LAB_PRONTO_EVENT = "lab-armazenamento-pronto";

export type OpcoesGravarArmazenamento = {
  /** Use `{ forcar: false }` apenas para atualizar cache local sem gravar no banco. */
  forcar?: boolean;
};

export function armazenamentoLaboratorioPronto() {
  return hidratado;
}

export function armazenamentoLaboratorioBootstrapOk() {
  return bootstrapOk;
}

/** Indica se a chave já foi carregada do PostgreSQL (JsonStore). */
export function chaveExisteNoServidor(key: string) {
  return chavesDoServidor.has(key);
}

function serializarValor(valor: unknown) {
  return JSON.stringify(valor);
}

function atualizarSnapshotServidor(key: string, valor: unknown) {
  snapshotServidor.set(key, serializarValor(valor));
  chavesDoServidor.add(key);
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

function aplicarBootstrap(data: Record<string, unknown>) {
  cache.clear();
  chavesDoServidor.clear();
  snapshotServidor.clear();
  for (const [key, valor] of Object.entries(data)) {
    cache.set(key, valor);
    atualizarSnapshotServidor(key, valor);
  }
}

/** Toda alteração no cache deve ir para o PostgreSQL (JsonStore). */
function devePersistirGravacao(
  key: string,
  valor: unknown,
  opcoes?: OpcoesGravarArmazenamento
) {
  if (opcoes?.forcar === false) return false;
  const novo = serializarValor(valor);
  return snapshotServidor.get(key) !== novo;
}

/** Aplica valores de limpeza/restauração no cache e persiste no servidor. */
export async function aplicarArmazenamentoLaboratorioCliente(
  keysRemover: string[],
  prefixosRemover: string[],
  valores: Record<string, unknown>
) {
  for (const [key, valor] of Object.entries(valores)) {
    gravarArmazenamentoCache(key, valor, { forcar: true });
  }
  for (const key of keysRemover) {
    if (key in valores) continue;
    cache.delete(key);
    chavesDoServidor.delete(key);
    snapshotServidor.delete(key);
    filaSalvar.set(key, null);
  }
  if (prefixosRemover.some((p) => p.startsWith(LISTAGEM_CONFIG_PREFIX))) {
    cache.delete(LISTAGEM_CONFIGS_KEY);
    chavesDoServidor.delete(LISTAGEM_CONFIGS_KEY);
    snapshotServidor.delete(LISTAGEM_CONFIGS_KEY);
    filaSalvar.set(LISTAGEM_CONFIGS_KEY, {});
  }
  await flushSalvarPendentes();
}

const BOOTSTRAP_TIMEOUT_MS = 15_000;
const BOOTSTRAP_TENTATIVAS = 3;

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

async function flushSalvarPendentes() {
  if (filaSalvar.size === 0) return;
  const entradas = Object.fromEntries(filaSalvar.entries());
  filaSalvar.clear();
  if (timerSalvar) {
    clearTimeout(timerSalvar);
    timerSalvar = null;
  }

  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      const res = await fetch("/api/armazenamento/migrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ entradas, sobrescrever: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const [key, valor] of Object.entries(entradas)) {
        if (valor === null) {
          chavesDoServidor.delete(key);
          snapshotServidor.delete(key);
          continue;
        }
        atualizarSnapshotServidor(key, valor);
      }
      return;
    } catch (err) {
      console.error(
        `[armazenamento-laboratorio] falha ao salvar (tentativa ${tentativa}/3)`,
        err
      );
      if (tentativa === 3) {
        for (const [k, v] of Object.entries(entradas)) {
          filaSalvar.set(k, v);
        }
      }
    }
  }
}

function flushSalvarPendentesKeepalive() {
  if (filaSalvar.size === 0) return;
  const entradas = Object.fromEntries(filaSalvar.entries());
  filaSalvar.clear();
  if (timerSalvar) {
    clearTimeout(timerSalvar);
    timerSalvar = null;
  }
  try {
    void fetch("/api/armazenamento/migrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify({ entradas, sobrescrever: true }),
    });
    for (const [key, valor] of Object.entries(entradas)) {
      if (valor === null) {
        chavesDoServidor.delete(key);
        snapshotServidor.delete(key);
        continue;
      }
      atualizarSnapshotServidor(key, valor);
    }
  } catch {
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

async function carregarBootstrapServidor(): Promise<boolean> {
  for (let tentativa = 1; tentativa <= BOOTSTRAP_TENTATIVAS; tentativa += 1) {
    try {
      const res = await fetchComTimeout("/api/armazenamento/bootstrap", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: Record<string, unknown> };
      if (json.data && typeof json.data === "object") {
        aplicarBootstrap(json.data);
        return true;
      }
    } catch (err) {
      console.warn(
        `[armazenamento-laboratorio] bootstrap tentativa ${tentativa}/${BOOTSTRAP_TENTATIVAS}`,
        err
      );
    }
  }
  return false;
}

/** Força nova carga do banco (ex.: botão "Tentar novamente"). */
export async function reinicializarArmazenamentoLaboratorio() {
  if (typeof window === "undefined") return;
  hidratado = false;
  bootstrapOk = false;
  hidratando = null;
  return inicializarArmazenamentoLaboratorio();
}

/** Carrega dados do banco e migra resquícios do localStorage (uma vez). */
export async function inicializarArmazenamentoLaboratorio() {
  if (typeof window === "undefined") return;
  if (hidratado) return;
  if (hidratando) return hidratando;

  hidratando = (async () => {
    const legadoColetado = coletarMigracaoLocal();
    if (Object.keys(legadoColetado).length > 0) {
      await enviarMigracaoLocal(legadoColetado);
    }

    bootstrapOk = await carregarBootstrapServidor();
    if (!bootstrapOk && Object.keys(legadoColetado).length > 0) {
      aplicarBootstrap(legadoColetado);
      bootstrapOk = true;
    }
  })()
    .catch((err) => {
      console.error("[armazenamento-laboratorio] falha na inicialização", err);
      bootstrapOk = false;
    })
    .finally(() => {
      hidratado = true;
      dispararPronto();
      hidratando = null;
      void flushSalvarPendentes();
    });

  return hidratando;
}

/** Atualiza o cache em memória com dados mais recentes do servidor. */
export async function revalidarArmazenamentoLaboratorio() {
  if (typeof window === "undefined" || !hidratado) return;
  bootstrapOk = await carregarBootstrapServidor();
}

export function lerArmazenamentoCache<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  return fallback;
}

export function gravarArmazenamentoCache<T>(
  key: string,
  valor: T,
  opcoes?: OpcoesGravarArmazenamento
) {
  cache.set(key, valor);
  if (typeof window === "undefined") return;
  if (!devePersistirGravacao(key, valor, opcoes)) return;

  if (!hidratado) {
    filaSalvar.set(key, valor);
    return;
  }

  agendarSalvar(key, valor);
}

export async function persistirArmazenamentoImediato(key: string, valor: unknown) {
  cache.set(key, valor);
  filaSalvar.delete(key);

  const res = await fetch("/api/armazenamento/migrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ entradas: { [key]: valor }, sobrescrever: true }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao gravar ${key} no servidor (${res.status})`);
  }

  atualizarSnapshotServidor(key, valor);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSalvarPendentesKeepalive);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushSalvarPendentes();
    }
  });
}
