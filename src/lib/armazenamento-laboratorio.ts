import {
  ARMAZENAMENTO_LAB_PREFIX,
  CHAVES_ARMAZENAMENTO_LAB,
  LISTAGEM_CONFIG_PREFIX,
  LISTAGEM_CONFIGS_KEY,
  MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO,
  THEME_STORAGE_KEY_LEGADO,
} from "@/lib/armazenamento-laboratorio-keys";

/** Espelho em memória dos dados do PostgreSQL (JsonStore) — não usa localStorage. */
const espelho = new Map<string, unknown>();
const chavesDoServidor = new Set<string>();
const snapshotServidor = new Map<string, string>();
let hidratado = false;
let bootstrapOk = false;
let hidratando: Promise<void> | null = null;
const filaSalvar = new Map<string, unknown>();
let timerSalvar: ReturnType<typeof setTimeout> | null = null;

export const ARMAZENAMENTO_LAB_PRONTO_EVENT = "lab-armazenamento-pronto";

export type OpcoesGravarArmazenamento = {
  /** @deprecated Use aplicarEspelhoServidor para leituras do servidor sem gravar. */
  forcar?: boolean;
};

export function armazenamentoLaboratorioPronto() {
  return hidratado;
}

export function armazenamentoLaboratorioBootstrapOk() {
  return bootstrapOk;
}

/** Aguarda carga inicial do banco (para impressão e telas que dependem do JsonStore). */
export function aguardarArmazenamentoLaboratorioPronto(timeoutMs = 8000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (armazenamentoLaboratorioPronto() && armazenamentoLaboratorioBootstrapOk()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    const onPronto = () => {
      if (!armazenamentoLaboratorioPronto() || !armazenamentoLaboratorioBootstrapOk()) return;
      window.clearTimeout(timer);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
      resolve();
    };
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onPronto);
    onPronto();
  });
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

/** Remove resquícios antigos do localStorage (dados do lab ficam só no banco). */
function limparLocalStorageLegadoLab() {
  if (typeof window === "undefined") return;
  const remover = new Set<string>(CHAVES_ARMAZENAMENTO_LAB);
  remover.add(LISTAGEM_CONFIGS_KEY);
  remover.add(THEME_STORAGE_KEY_LEGADO);
  remover.add("labProteseLembrarLoginSenha");

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith(ARMAZENAMENTO_LAB_PREFIX) ||
      key.startsWith(LISTAGEM_CONFIG_PREFIX) ||
      key.startsWith(MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO)
    ) {
      remover.add(key);
    }
  }

  for (const key of remover) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function aplicarBootstrap(data: Record<string, unknown>) {
  espelho.clear();
  chavesDoServidor.clear();
  snapshotServidor.clear();
  for (const [key, valor] of Object.entries(data)) {
    espelho.set(key, valor);
    atualizarSnapshotServidor(key, valor);
  }
}

/** Atualiza espelho em memória com valor do servidor — não regrava no banco. */
export function aplicarEspelhoServidor(key: string, valor: unknown) {
  espelho.set(key, valor);
  atualizarSnapshotServidor(key, valor);
}

/** Toda alteração do usuário deve ir para o PostgreSQL (JsonStore). */
function devePersistirGravacao(
  key: string,
  valor: unknown,
  opcoes?: OpcoesGravarArmazenamento
) {
  if (opcoes?.forcar === false) return false;
  const novo = serializarValor(valor);
  return snapshotServidor.get(key) !== novo;
}

/** Aplica valores de limpeza/restauração e persiste no servidor. */
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
    espelho.delete(key);
    chavesDoServidor.delete(key);
    snapshotServidor.delete(key);
    filaSalvar.set(key, null);
  }
  if (prefixosRemover.some((p) => p.startsWith(LISTAGEM_CONFIG_PREFIX))) {
    espelho.delete(LISTAGEM_CONFIGS_KEY);
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

/** Carrega dados do PostgreSQL (JsonStore). Não usa localStorage. */
export async function inicializarArmazenamentoLaboratorio() {
  if (typeof window === "undefined") return;
  if (hidratado) return;
  if (hidratando) return hidratando;

  hidratando = (async () => {
    limparLocalStorageLegadoLab();
    bootstrapOk = await carregarBootstrapServidor();
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

/** Recarrega espelho em memória a partir do banco (sem localStorage). */
export async function revalidarArmazenamentoLaboratorio() {
  if (typeof window === "undefined" || !hidratado) return;
  const ok = await carregarBootstrapServidor();
  bootstrapOk = ok;
  if (ok) dispararPronto();
}

export function lerArmazenamentoCache<T>(key: string, fallback: T): T {
  if (espelho.has(key)) return espelho.get(key) as T;
  return fallback;
}

export function gravarArmazenamentoCache<T>(
  key: string,
  valor: T,
  opcoes?: OpcoesGravarArmazenamento
) {
  espelho.set(key, valor);
  if (typeof window === "undefined") return;
  if (!devePersistirGravacao(key, valor, opcoes)) return;

  if (!hidratado) {
    filaSalvar.set(key, valor);
    return;
  }

  agendarSalvar(key, valor);
}

export async function persistirArmazenamentoImediato(key: string, valor: unknown) {
  espelho.set(key, valor);
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
      return;
    }
    if (document.visibilityState === "visible" && hidratado) {
      void revalidarArmazenamentoLaboratorio();
    }
  });
  window.addEventListener("focus", () => {
    if (hidratado) void revalidarArmazenamentoLaboratorio();
  });
}
