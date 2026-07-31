/**
 * Cliente Microsoft Graph para OneDrive — upload/download/delete direto na nuvem.
 * Não grava arquivo em disco na VPS (só Buffer em memória durante a requisição).
 *
 * Auth (delegated, refresh token) — recomendado para OneDrive pessoal/empresarial:
 *   ONEDRIVE_GRAPH_CLIENT_ID
 *   ONEDRIVE_GRAPH_CLIENT_SECRET
 *   ONEDRIVE_GRAPH_TENANT_ID=common
 *   ONEDRIVE_GRAPH_REFRESH_TOKEN
 *
 * Opcional:
 *   ONEDRIVE_GRAPH_ROOT_FOLDER=Lab_Protese
 *   ONEDRIVE_GRAPH_DRIVE_ID=  (se vazio, usa /me/drive)
 */
type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

const globalGraph = globalThis as typeof globalThis & {
  __onedriveGraphToken?: TokenCache;
  __onedriveGraphPastas?: Set<string>;
};

function env(nome: string) {
  return process.env[nome]?.trim() || "";
}

export function onedriveGraphConfigurado() {
  return Boolean(
    env("ONEDRIVE_GRAPH_CLIENT_ID") &&
      env("ONEDRIVE_GRAPH_CLIENT_SECRET") &&
      env("ONEDRIVE_GRAPH_REFRESH_TOKEN")
  );
}

export function onedriveGraphRootFolder() {
  return (
    env("ONEDRIVE_GRAPH_ROOT_FOLDER") ||
    env("ONEDRIVE_UPLOADS_ROOT") ||
    "Lab_Protese"
  );
}

function tenantId() {
  // Contas pessoais (@outlook.com) exigem /consumers (não /common).
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

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    globalGraph.__onedriveGraphToken = undefined;
    const token2 = await obterAccessToken();
    headers.set("Authorization", `Bearer ${token2}`);
    return fetch(url, { ...init, headers });
  }
  return res;
}

function cachePastas() {
  if (!globalGraph.__onedriveGraphPastas) {
    globalGraph.__onedriveGraphPastas = new Set();
  }
  return globalGraph.__onedriveGraphPastas;
}

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

  // Já existe (nameAlreadyExists) ou equivalente
  const text = await res.text().catch(() => "");
  if (/nameAlreadyExists|already exists|conflict/i.test(text) || res.status === 409) {
    cachePastas().add(chave);
    return;
  }

  throw new Error(`Falha ao criar pasta OneDrive "${chave}": ${res.status} ${text.slice(0, 240)}`);
}

/** Garante Lab_Protese/{empresa}/uploads/{modulo}/... */
export async function garantirCaminhoPastasOneDrive(remotePath: string) {
  const segmentos = remotePath
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  // último segmento é o arquivo
  const pastas = segmentos.slice(0, -1);
  let atual = "";
  for (const pasta of pastas) {
    await criarPastaSeNaoExistir(atual, pasta);
    atual = atual ? `${atual}/${pasta}` : pasta;
  }
}

export async function uploadBytesOneDriveGraph(
  remotePath: string,
  bytes: Buffer,
  mimeType?: string
) {
  await garantirCaminhoPastasOneDrive(remotePath);
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

  return res.json().catch(() => null);
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

/**
 * Estrutura por laboratório (cliente do SaaS):
 *   Lab_Protese/{slug}/
 *     backups/          ← rclone de backup (opcional)
 *     uploads/
 *       os|despesas|receitas|produtos|disparos-whatsapp|suporte/
 */
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

/** Cria Lab_Protese/{slug}/backups e Lab_Protese/{slug}/uploads/{modulos}. */
export async function garantirEstruturaPastasEmpresaOneDrive(empresaSlug: string) {
  const raiz = caminhoRemotoEmpresaRaiz(empresaSlug);
  const backups = `${raiz}/backups`;
  const uploads = `${raiz}/uploads`;
  const modulos = ["os", "despesas", "receitas", "produtos", "disparos-whatsapp", "suporte"];

  // cria placeholders via pastas (arquivo .keep não necessário)
  await garantirCaminhoPastasOneDrive(`${backups}/.keep`);
  for (const m of modulos) {
    await garantirCaminhoPastasOneDrive(`${uploads}/${m}/.keep`);
  }
}
