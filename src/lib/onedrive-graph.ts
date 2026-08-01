/**
 * Cliente Microsoft Graph para OneDrive — upload/download/delete direto na nuvem.
 * Não grava arquivo em disco na VPS (só Buffer em memória durante a requisição).
 *
 * Auth (delegated, refresh token):
 *   ONEDRIVE_GRAPH_CLIENT_ID
 *   ONEDRIVE_GRAPH_CLIENT_SECRET
 *   ONEDRIVE_GRAPH_TENANT_ID=consumers
 *   ONEDRIVE_GRAPH_REFRESH_TOKEN
 *
 * Opcional:
 *   ONEDRIVE_GRAPH_ROOT_FOLDER=Documents/Lab_Protese_Backups
 *   ONEDRIVE_GRAPH_DRIVE_ID=
 */
import { envRuntime } from "@/lib/env-runtime";

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

export type CotaOneDriveGraph = {
  total: number;
  used: number;
  remaining: number;
  state?: string;
};

const CACHE_COTA_MS = 45_000;

const MODULOS_UPLOAD = [
  "os",
  "despesas",
  "receitas",
  "produtos",
  "disparos-whatsapp",
  "suporte",
] as const;

const globalGraph = globalThis as typeof globalThis & {
  __onedriveGraphToken?: TokenCache;
  __onedriveGraphPastas?: Set<string>;
  __onedriveGraphRootResolvido?: string;
  __onedriveEstruturaEmpresa?: Set<string>;
  __onedriveGraphQuota?: { atMs: number; data: CotaOneDriveGraph };
};

function env(nome: string) {
  return envRuntime(nome);
}

export function onedriveGraphConfigurado() {
  return Boolean(
    env("ONEDRIVE_GRAPH_CLIENT_ID") &&
      env("ONEDRIVE_GRAPH_CLIENT_SECRET") &&
      env("ONEDRIVE_GRAPH_REFRESH_TOKEN")
  );
}

/**
 * Pasta-base dos uploads.
 * Preferência: valor já resolvido em runtime > env > Documents/Lab_Protese_Backups.
 */
export function onedriveGraphRootFolder() {
  if (globalGraph.__onedriveGraphRootResolvido) {
    return globalGraph.__onedriveGraphRootResolvido;
  }
  return (
    env("ONEDRIVE_GRAPH_ROOT_FOLDER") ||
    env("ONEDRIVE_UPLOADS_ROOT") ||
    "Documents/Lab_Protese_Backups"
  );
}

function tenantId() {
  return env("ONEDRIVE_GRAPH_TENANT_ID") || "consumers";
}

function driveBasePath() {
  const driveId = env("ONEDRIVE_GRAPH_DRIVE_ID");
  if (driveId) return `/drives/${encodeURIComponent(driveId)}`;
  return "/me/drive";
}

function encodePathSegments(remotePath: string) {
  return remotePath
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

function cachePastas() {
  if (!globalGraph.__onedriveGraphPastas) {
    globalGraph.__onedriveGraphPastas = new Set();
  }
  return globalGraph.__onedriveGraphPastas;
}

function cacheEstruturaEmpresa() {
  if (!globalGraph.__onedriveEstruturaEmpresa) {
    globalGraph.__onedriveEstruturaEmpresa = new Set();
  }
  return globalGraph.__onedriveEstruturaEmpresa;
}

async function obterAccessToken(): Promise<string> {
  const cache = globalGraph.__onedriveGraphToken;
  if (cache && cache.expiresAtMs > Date.now() + 60_000) {
    return cache.accessToken;
  }

  if (!onedriveGraphConfigurado()) {
    throw new Error(
      "OneDrive Graph não configurado. Defina ONEDRIVE_GRAPH_CLIENT_ID, ONEDRIVE_GRAPH_CLIENT_SECRET e ONEDRIVE_GRAPH_REFRESH_TOKEN."
    );
  }

  const body = new URLSearchParams({
    client_id: env("ONEDRIVE_GRAPH_CLIENT_ID"),
    client_secret: env("ONEDRIVE_GRAPH_CLIENT_SECRET"),
    refresh_token: env("ONEDRIVE_GRAPH_REFRESH_TOKEN"),
    grant_type: "refresh_token",
    scope: "offline_access Files.ReadWrite Files.ReadWrite.All User.Read",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId())}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Falha ao renovar token OneDrive Graph: ${json.error_description || json.error || res.status}`
    );
  }

  globalGraph.__onedriveGraphToken = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

async function graphFetch(pathname: string, init?: RequestInit) {
  const token = await obterAccessToken();
  const url = pathname.startsWith("http")
    ? pathname
    : `https://graph.microsoft.com/v1.0${pathname}`;

  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    globalGraph.__onedriveGraphToken = undefined;
    const token2 = await obterAccessToken();
    headers.set("Authorization", `Bearer ${token2}`);
    res = await fetch(url, { ...init, headers });
  }
  if (res.status === 429) {
    // Até 2 retentativas; espera curta quando não há Retry-After (Graph às vezes omite).
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const retryAfterRaw = res.headers.get("Retry-After");
      const retryAfter = Number(retryAfterRaw);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000)
        : 250 + tentativa * 250;
      await new Promise((r) => setTimeout(r, waitMs));
      res = await fetch(url, { ...init, headers });
      if (res.status !== 429) break;
    }
  }
  return res;
}

async function pastaExisteOneDrive(remoteFolderPath: string): Promise<boolean> {
  const limpo = remoteFolderPath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!limpo) return true;
  const encoded = encodePathSegments(limpo);
  const res = await graphFetch(
    `${driveBasePath()}/root:/${encoded}?$select=id,folder,name`
  );
  if (!res.ok) return false;
  const json = (await res.json().catch(() => null)) as { folder?: unknown } | null;
  return Boolean(json?.folder);
}

/**
 * Cria uma pasta se não existir (o pai já deve existir).
 * POST primeiro (1 RTT); 409 = já existe. GET só como fallback.
 */
async function criarPastaSeNaoExistir(parentPath: string, nome: string) {
  const chave = parentPath ? `${parentPath}/${nome}` : nome;
  if (cachePastas().has(chave)) return;

  const parentEncoded = parentPath ? encodePathSegments(parentPath) : "";
  const childrenUrl = parentEncoded
    ? `${driveBasePath()}/root:/${parentEncoded}:/children`
    : `${driveBasePath()}/root/children`;

  const res = await graphFetch(childrenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nome,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (res.ok || res.status === 409) {
    cachePastas().add(chave);
    return;
  }

  const text = await res.text().catch(() => "");
  if (/nameAlreadyExists|already exists|conflict/i.test(text)) {
    cachePastas().add(chave);
    return;
  }

  if (await pastaExisteOneDrive(chave)) {
    cachePastas().add(chave);
    return;
  }

  throw new Error(
    `Falha ao criar pasta OneDrive "${chave}": ${res.status} ${text.slice(0, 240)}`
  );
}

/**
 * Garante toda a cadeia de pastas até o arquivo
 * (ex.: Documents/Lab_Protese_Backups/{slug}/uploads/os/arquivo.png).
 */
export async function garantirCaminhoPastasOneDrive(remotePath: string) {
  const segmentos = remotePath
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  const pastas = segmentos.slice(0, -1);
  let atual = "";
  for (const pasta of pastas) {
    await criarPastaSeNaoExistir(atual, pasta);
    atual = atual ? `${atual}/${pasta}` : pasta;
  }
}

const LIMITE_UPLOAD_SIMPLES = 4 * 1024 * 1024;
/** Fragmentos da sessão Graph devem ser múltiplos de 320 KiB (exceto o último). */
const TAMANHO_FRAGMENTO = 10 * 320 * 1024; // 3.125 MiB

async function uploadViaSessaoOneDrive(
  remotePath: string,
  bytes: Buffer,
  mimeType?: string
): Promise<{ id?: string; webUrl?: string; name?: string } | null> {
  const encoded = encodePathSegments(remotePath);
  const sessionRes = await graphFetch(
    `${driveBasePath()}/root:/${encoded}:/createUploadSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: remotePath.split("/").pop() || "arquivo",
        },
      }),
    }
  );

  if (!sessionRes.ok) {
    const text = await sessionRes.text().catch(() => "");
    throw new Error(
      `Sessão de upload OneDrive falhou (${sessionRes.status}): ${text.slice(0, 300)}`
    );
  }

  const session = (await sessionRes.json()) as { uploadUrl?: string };
  if (!session.uploadUrl) {
    throw new Error("Sessão de upload OneDrive sem uploadUrl");
  }

  const total = bytes.length;
  let offset = 0;
  let ultimoJson: { id?: string; webUrl?: string; name?: string } | null = null;

  while (offset < total) {
    const end = Math.min(offset + TAMANHO_FRAGMENTO, total);
    const chunk = bytes.subarray(offset, end);
    const res = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
        ...(mimeType ? { "Content-Type": mimeType } : {}),
      },
      body: new Uint8Array(chunk),
    });

    if (!(res.status === 202 || res.ok)) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Fragmento OneDrive falhou (${res.status}) @${offset}: ${text.slice(0, 240)}`
      );
    }

    if (res.status === 200 || res.status === 201) {
      ultimoJson = (await res.json().catch(() => null)) as {
        id?: string;
        webUrl?: string;
        name?: string;
      } | null;
    }
    offset = end;
  }

  return ultimoJson;
}

/** Grava bytes (cria pastas intermediárias se faltarem). Usa sessão se > 4 MB. */
export async function uploadBytesOneDriveGraph(
  remotePath: string,
  bytes: Buffer,
  mimeType?: string,
  opcoes?: { garantirPastas?: boolean }
): Promise<{ id?: string; webUrl?: string; name?: string } | null> {
  await resolverPastaRaizOneDriveGraph();
  if (opcoes?.garantirPastas !== false) {
    await garantirCaminhoPastasOneDrive(remotePath);
  }

  if (bytes.length > LIMITE_UPLOAD_SIMPLES) {
    const json = await uploadViaSessaoOneDrive(remotePath, bytes, mimeType);
    if (json?.webUrl) console.info(`[onedrive-graph] arquivo (sessão): ${json.webUrl}`);
    return json;
  }

  const encoded = encodePathSegments(remotePath);
  const url = `${driveBasePath()}/root:/${encoded}:/content`;

  const res = await graphFetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: new Uint8Array(bytes),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload OneDrive Graph falhou (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json().catch(() => null)) as {
    id?: string;
    webUrl?: string;
    name?: string;
  } | null;
  if (json?.webUrl) {
    console.info(`[onedrive-graph] arquivo: ${json.webUrl}`);
  }
  return json;
}

/** Lista filhos de uma pasta (caminho relativo à raiz do drive). */
export async function listarPastaOneDriveGraph(
  remoteFolderPath: string
): Promise<Array<{ name: string; folder?: boolean; webUrl?: string }>> {
  const limpo = remoteFolderPath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!limpo) return listarRaizOneDriveGraph();
  const encoded = encodePathSegments(limpo);
  const res = await graphFetch(
    `${driveBasePath()}/root:/${encoded}:/children?$select=name,folder,webUrl&$top=50`
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Listar pasta OneDrive falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    value?: Array<{ name?: string; folder?: unknown; webUrl?: string }>;
  };
  return (json.value || []).map((item) => ({
    name: item.name || "",
    folder: Boolean(item.folder),
    webUrl: item.webUrl,
  }));
}

/**
 * Descobre a pasta Lab_Protese_Backups visível no OneDrive web.
 * Prioriza Documents/...; se não existir, cria Documents/Lab_Protese_Backups.
 */
export async function resolverPastaRaizOneDriveGraph(): Promise<string> {
  if (globalGraph.__onedriveGraphRootResolvido) {
    return globalGraph.__onedriveGraphRootResolvido;
  }

  const explicito = (
    env("ONEDRIVE_GRAPH_ROOT_FOLDER") ||
    env("ONEDRIVE_UPLOADS_ROOT") ||
    ""
  ).replace(/^[/\\]+|[/\\]+$/g, "");

  const preferidos = [
    explicito && explicito !== "Lab_Protese_Backups" && explicito !== "Lab_Protese"
      ? explicito
      : "",
    "Documents/Lab_Protese_Backups",
    "Lab_Protese_Backups",
  ].filter(Boolean);

  for (const c of preferidos) {
    if (await pastaExisteOneDrive(c)) {
      globalGraph.__onedriveGraphRootResolvido = c;
      console.info(`[onedrive-graph] pasta raiz: ${c}`);
      return c;
    }
  }

  // Não existe: cria a cadeia (Documents/Lab_Protese_Backups ou o valor do .env).
  const alvo = explicito || "Documents/Lab_Protese_Backups";
  await garantirCaminhoPastasOneDrive(`${alvo}/.keep`);
  globalGraph.__onedriveGraphRootResolvido = alvo;
  console.info(`[onedrive-graph] pasta raiz criada: ${alvo}`);
  return alvo;
}

/** Lista pastas/arquivos na raiz do OneDrive autenticado (diagnóstico). */
export async function listarRaizOneDriveGraph(): Promise<
  Array<{ name: string; folder?: boolean; webUrl?: string }>
> {
  const res = await graphFetch(
    `${driveBasePath()}/root/children?$select=name,folder,webUrl&$top=50`
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Listar raiz OneDrive falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    value?: Array<{ name?: string; folder?: unknown; webUrl?: string }>;
  };
  return (json.value || []).map((item) => ({
    name: item.name || "",
    folder: Boolean(item.folder),
    webUrl: item.webUrl,
  }));
}

/** Retorna quem é o dono do drive (e-mail) para confirmar a conta certa. */
export async function quemSouOneDriveGraph(): Promise<{
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
}> {
  const res = await graphFetch("/me?$select=displayName,userPrincipalName,mail");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph /me falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as {
    displayName?: string;
    userPrincipalName?: string;
    mail?: string;
  };
}

/** Invalida cache da cota (após upload/exclusão). */
export function limparCacheCotaOneDriveGraph() {
  globalGraph.__onedriveGraphQuota = undefined;
}

/**
 * Ajuste otimista da cota após exclusão — o Graph pode demorar a refletir.
 * Mantém o card sincronizado em tempo real enquanto a nuvem atualiza.
 */
export function ajustarCotaOneDriveAposExclusao(bytesRemovidos: number) {
  const n = Math.max(0, Math.floor(bytesRemovidos));
  if (n <= 0) {
    limparCacheCotaOneDriveGraph();
    return;
  }
  const cache = globalGraph.__onedriveGraphQuota;
  if (!cache) return;
  const used = Math.max(0, cache.data.used - n);
  const remaining = Math.max(0, cache.data.total - used);
  globalGraph.__onedriveGraphQuota = {
    atMs: Date.now(),
    data: {
      ...cache.data,
      used,
      remaining,
    },
  };
}

/** Ajuste otimista após upload (evita limpar cache a cada arquivo do lote). */
export function ajustarCotaOneDriveAposUpload(bytesAdicionados: number) {
  const n = Math.max(0, Math.floor(bytesAdicionados));
  if (n <= 0) return;
  const cache = globalGraph.__onedriveGraphQuota;
  if (!cache) return;
  const used = cache.data.used + n;
  const remaining = Math.max(0, cache.data.total - used);
  globalGraph.__onedriveGraphQuota = {
    atMs: Date.now(),
    data: {
      ...cache.data,
      used,
      remaining,
    },
  };
}

/**
 * Cota real do OneDrive (usado / livre / total) via Microsoft Graph.
 * Cache curto para não bater no Graph a cada refresh do dashboard.
 */
export async function obterCotaOneDriveGraph(
  force = false
): Promise<CotaOneDriveGraph | null> {
  if (!onedriveGraphConfigurado()) return null;

  const cache = globalGraph.__onedriveGraphQuota;
  if (!force && cache && Date.now() - cache.atMs < CACHE_COTA_MS) {
    return cache.data;
  }

  const res = await graphFetch(`${driveBasePath()}?$select=id,quota`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cota OneDrive falhou (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    quota?: {
      total?: number | string;
      used?: number | string;
      remaining?: number | string;
      state?: string;
    };
  };
  const q = json.quota;
  if (!q) return null;

  const total = Math.max(0, Number(q.total) || 0);
  const usedGraph = Math.max(0, Number(q.used) || 0);
  const remainingRaw = Number(q.remaining);
  const remainingGraph = Number.isFinite(remainingRaw)
    ? Math.max(0, remainingRaw)
    : Math.max(0, total - usedGraph);

  // Graph pode atrasar após exclusão: mantém o otimista se ainda indicar mais espaço livre.
  let remaining = remainingGraph;
  let used = usedGraph;
  if (cache && cache.data.total === total && cache.data.remaining > remainingGraph) {
    remaining = cache.data.remaining;
    used = Math.max(0, total - remaining);
  }

  const data: CotaOneDriveGraph = {
    total,
    used,
    remaining,
    state: typeof q.state === "string" ? q.state : undefined,
  };
  globalGraph.__onedriveGraphQuota = { atMs: Date.now(), data };
  return data;
}

export async function downloadBytesOneDriveGraph(remotePath: string): Promise<Buffer> {
  const encoded = encodePathSegments(remotePath);
  const url = `${driveBasePath()}/root:/${encoded}:/content`;
  const res = await graphFetch(url, { method: "GET" });
  if (res.status === 404) {
    throw new Error(`Arquivo não encontrado no OneDrive: ${remotePath}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Download OneDrive Graph falhou (${res.status}): ${text.slice(0, 300)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function deleteItemOneDriveGraph(remotePath: string): Promise<void> {
  const encoded = encodePathSegments(remotePath);
  const url = `${driveBasePath()}/root:/${encoded}`;
  const res = await graphFetch(url, { method: "DELETE" });
  if (res.ok || res.status === 204 || res.status === 404) return;
  const text = await res.text().catch(() => "");
  if (/not found|itemNotFound/i.test(text)) return;
  throw new Error(`Delete OneDrive Graph falhou (${res.status}): ${text.slice(0, 300)}`);
}

export async function deletePastaOneDriveGraph(remoteFolderPath: string): Promise<void> {
  const encoded = encodePathSegments(remoteFolderPath);
  if (!encoded) return;
  const url = `${driveBasePath()}/root:/${encoded}`;
  const res = await graphFetch(url, { method: "DELETE" });
  if (res.ok || res.status === 204 || res.status === 404) return;
  const text = await res.text().catch(() => "");
  if (/not found|itemNotFound/i.test(text)) return;
  throw new Error(`Purge pasta OneDrive falhou (${res.status}): ${text.slice(0, 300)}`);
}

export function caminhoRemotoEmpresaUploads(
  empresaSlug: string,
  pastaModulo: string,
  filename: string
) {
  const slug = empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const root = onedriveGraphRootFolder().replace(/^[/\\]+|[/\\]+$/g, "");
  const modulo = pastaModulo.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const nome = filename.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  return `${root}/${slug}/uploads/${modulo}/${nome}`;
}

export function caminhoRemotoEmpresaBackups(empresaSlug: string) {
  const slug = empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const root = onedriveGraphRootFolder().replace(/^[/\\]+|[/\\]+$/g, "");
  return `${root}/${slug}/backups`;
}

export function caminhoRemotoEmpresaRaiz(empresaSlug: string) {
  const slug = empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const root = onedriveGraphRootFolder().replace(/^[/\\]+|[/\\]+$/g, "");
  return `${root}/${slug}`;
}

/**
 * Garante só a pasta do módulo do upload (ex.: .../{slug}/uploads/os).
 * Sem .keep nos demais módulos — bem mais rápido no salvamento da OS.
 */
export async function garantirPastaModuloUploadOneDrive(
  empresaSlug: string,
  pastaModulo: string
) {
  await resolverPastaRaizOneDriveGraph();
  const slug = empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return;

  const modulo = pastaModulo.replace(/^[/\\]+/, "").replace(/\\/g, "/").split("/")[0];
  if (!modulo) return;

  const chaveCache = `${slug}::uploads::${modulo}`;
  if (cacheEstruturaEmpresa().has(chaveCache)) return;

  const remotePath = caminhoRemotoEmpresaUploads(slug, modulo, ".keep");
  await garantirCaminhoPastasOneDrive(remotePath);
  cacheEstruturaEmpresa().add(chaveCache);
}

/**
 * Cria (se faltar) a árvore do laboratório e deixa um .keep em cada módulo
 * para a pasta aparecer no OneDrive web (pastas vazias somem/não sincronizam).
 * Usar em scripts/migração — não no caminho quente de upload da OS.
 */
export async function garantirEstruturaPastasEmpresaOneDrive(empresaSlug: string) {
  await resolverPastaRaizOneDriveGraph();
  const slug = empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return;

  if (cacheEstruturaEmpresa().has(slug)) return;

  const raiz = caminhoRemotoEmpresaRaiz(slug);
  const keep = Buffer.from("lab-protese\n", "utf8");

  await garantirCaminhoPastasOneDrive(`${raiz}/backups/.keep`);
  await uploadBytesOneDriveGraph(`${raiz}/backups/.keep`, keep, "text/plain", {
    garantirPastas: false,
  });

  await Promise.all(
    MODULOS_UPLOAD.map(async (m) => {
      const pathKeep = `${raiz}/uploads/${m}/.keep`;
      await garantirCaminhoPastasOneDrive(pathKeep);
      await uploadBytesOneDriveGraph(pathKeep, keep, "text/plain", {
        garantirPastas: false,
      });
      cacheEstruturaEmpresa().add(`${slug}::uploads::${m}`);
    })
  );

  cacheEstruturaEmpresa().add(slug);
  console.info(`[onedrive-graph] estrutura pronta: ${raiz}/uploads/{${MODULOS_UPLOAD.join(",")}}`);
}
