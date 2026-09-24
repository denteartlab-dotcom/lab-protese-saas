/**
 * Auth Google Drive: OAuth (conta Google pessoal) OU service account (Shared Drive / Workspace).
 * Sem Workspace, use OAuth — SA não grava no "Meu Drive".
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { nomePastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import {
  carregarEnvArquivoRuntime,
  envRuntime,
  limparCacheEnvRuntime,
} from "@/lib/env-runtime";

export const GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];
export const GOOGLE_DRIVE_PASTA_RAIZ_PADRAO = "Lab_Protese_Backups";
export const GOOGLE_DRIVE_MIME_FOLDER =
  "application/vnd.google-apps.folder";

type CredenciaisServiceAccount = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

const globalPastasDrive = globalThis as typeof globalThis & {
  __gdrivePastas?: Map<string, string>;
};

function cachePastasDrive() {
  if (!globalPastasDrive.__gdrivePastas) {
    globalPastasDrive.__gdrivePastas = new Map();
  }
  return globalPastasDrive.__gdrivePastas;
}

export function flagEnvAtiva(valor?: string | null) {
  const flag = valor?.trim().toLowerCase();
  if (!flag) return false;
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}

export function pastaRaizGoogleDriveId() {
  carregarEnvArquivoRuntime();
  return (
    envRuntime("GOOGLE_DRIVE_FOLDER_ID").trim() ||
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() ||
    null
  );
}

export function nomePastaRaizGoogleDrive() {
  carregarEnvArquivoRuntime();
  return (
    envRuntime("GOOGLE_DRIVE_ROOT_FOLDER_NAME").trim() ||
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME?.trim() ||
    GOOGLE_DRIVE_PASTA_RAIZ_PADRAO
  );
}

function caminhoRefreshTokenGdrive() {
  return path.join(process.cwd(), ".gdrive-refresh-token");
}

export function normalizarPrivateKeyServiceAccount(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function credencialServiceAccountNormalizada(
  cred: CredenciaisServiceAccount
): CredenciaisServiceAccount {
  return {
    ...cred,
    private_key: normalizarPrivateKeyServiceAccount(String(cred.private_key || "")),
  };
}

function tokenRefreshUtilizavel(valor?: string | null) {
  const token = (valor || "").trim();
  return token.length > 20 ? token : "";
}

/** .env primeiro (token novo) e depois o arquivo (rotação). Sem duplicar. */
export function listarRefreshTokensGoogleDrive(): string[] {
  carregarEnvArquivoRuntime();
  const tokens: string[] = [];
  const adicionar = (valor?: string | null) => {
    const token = tokenRefreshUtilizavel(valor);
    if (token && !tokens.includes(token)) tokens.push(token);
  };

  adicionar(envRuntime("GOOGLE_DRIVE_REFRESH_TOKEN"));
  adicionar(process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

  try {
    const arquivo = caminhoRefreshTokenGdrive();
    if (existsSync(arquivo)) {
      adicionar(readFileSync(arquivo, "utf8"));
    }
  } catch {
    /* segue só com .env */
  }

  return tokens;
}

/** Primeiro token utilizável: .env e, se faltar, arquivo de rotação. */
export function obterRefreshTokenGoogleDrive(): string {
  return listarRefreshTokensGoogleDrive()[0] ?? "";
}

export function persistirRefreshTokenGoogleDrive(novoToken: string) {
  const token = novoToken.trim();
  if (token.length < 20) return;
  try {
    writeFileSync(caminhoRefreshTokenGdrive(), `${token}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = token;
    limparCacheEnvRuntime();
    carregarEnvArquivoRuntime(true);
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = token;
  } catch (err) {
    console.warn("[gdrive] não foi possível salvar refresh_token:", err);
  }
}

export function googleDriveOAuthConfigurado() {
  carregarEnvArquivoRuntime();
  const clientId =
    envRuntime("GOOGLE_DRIVE_CLIENT_ID").trim() ||
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    envRuntime("GOOGLE_DRIVE_CLIENT_SECRET").trim() ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() ||
    "";
  const refresh = obterRefreshTokenGoogleDrive();
  return Boolean(clientId && clientSecret && refresh);
}

export function googleDriveCredenciaisServiceAccountPresentes() {
  carregarEnvArquivoRuntime();
  return Boolean(
    envRuntime("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON").trim() ||
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim() ||
      envRuntime("GOOGLE_APPLICATION_CREDENTIALS").trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  );
}

/** OAuth ou service account. */
export function googleDriveCredenciaisPresentes() {
  return (
    googleDriveOAuthConfigurado() ||
    googleDriveCredenciaisServiceAccountPresentes()
  );
}

/** Pasta + OAuth (recomendado sem Workspace) ou service account (Shared Drive). */
export function googleDriveStorageConfigurado() {
  return Boolean(
    pastaRaizGoogleDriveId() &&
      (googleDriveOAuthConfigurado() ||
        googleDriveCredenciaisServiceAccountPresentes())
  );
}

export type ModoAuthGoogleDrive = "oauth" | "service_account" | null;

export function modoAuthGoogleDrive(): ModoAuthGoogleDrive {
  if (googleDriveOAuthConfigurado()) return "oauth";
  if (googleDriveCredenciaisServiceAccountPresentes()) return "service_account";
  return null;
}

export async function lerCredenciaisGoogleDriveServiceAccount(): Promise<CredenciaisServiceAccount | null> {
  carregarEnvArquivoRuntime();
  const inline =
    envRuntime("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON").trim() ||
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim() ||
    "";
  if (inline) {
    try {
      return credencialServiceAccountNormalizada(
        JSON.parse(inline) as CredenciaisServiceAccount
      );
    } catch {
      try {
        const decodificado = Buffer.from(inline, "base64").toString("utf8");
        return credencialServiceAccountNormalizada(
          JSON.parse(decodificado) as CredenciaisServiceAccount
        );
      } catch {
        console.error("[gdrive] GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON inválido.");
        return null;
      }
    }
  }

  const arquivo =
    envRuntime("GOOGLE_APPLICATION_CREDENTIALS").trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    "";
  if (!arquivo) return null;

  try {
    const conteudo = await readFile(arquivo, "utf8");
    return credencialServiceAccountNormalizada(
      JSON.parse(conteudo) as CredenciaisServiceAccount
    );
  } catch (erro) {
    console.error("[gdrive] falha ao ler GOOGLE_APPLICATION_CREDENTIALS:", erro);
    return null;
  }
}

function oauthClientIds() {
  carregarEnvArquivoRuntime();
  return {
    clientId:
      envRuntime("GOOGLE_DRIVE_CLIENT_ID").trim() ||
      process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() ||
      "",
    clientSecret:
      envRuntime("GOOGLE_DRIVE_CLIENT_SECRET").trim() ||
      process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() ||
      "",
  };
}

function montarClienteOAuthGoogleDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  oauth2.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      persistirRefreshTokenGoogleDrive(tokens.refresh_token);
    }
  });
  return oauth2;
}

async function criarClienteOAuthGoogleDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const oauth2 = montarClienteOAuthGoogleDrive(clientId, clientSecret, refreshToken);
  try {
    const renovado = await oauth2.getAccessToken();
    if (!renovado?.token) {
      console.warn("[gdrive] getAccessToken sem token; segue com refresh_token.");
    }
  } catch (erro) {
    console.warn(
      "[gdrive] getAccessToken falhou; segue com refresh_token (anexos já usam este modo):",
      erro instanceof Error ? erro.message : erro
    );
  }
  return google.drive({ version: "v3", auth: oauth2 });
}

async function criarClienteServiceAccountGoogleDrive() {
  const credenciais = await lerCredenciaisGoogleDriveServiceAccount();
  if (!credenciais?.client_email || !credenciais.private_key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: credenciais,
    scopes: GOOGLE_DRIVE_SCOPES,
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Cliente Drive: OAuth da conta Google (a mesma dos anexos).
 * Não cai para service account quando o OAuth existe — SA não grava no "Meu Drive".
 */
export async function criarClienteGoogleDrive(): Promise<drive_v3.Drive | null> {
  const { clientId, clientSecret } = oauthClientIds();
  const tokens = listarRefreshTokensGoogleDrive();

  if (clientId && clientSecret && tokens.length) {
    const refreshToken = tokens[0];
    const cliente = await criarClienteOAuthGoogleDrive(
      clientId,
      clientSecret,
      refreshToken
    );
    persistirRefreshTokenGoogleDrive(refreshToken);
    return cliente;
  }

  return criarClienteServiceAccountGoogleDrive();
}

export function escaparConsultaDrive(valor: string) {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function opcoesDriveCompartilhado() {
  return {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  } as const;
}

export async function pastaDriveExiste(drive: drive_v3.Drive, pastaId: string) {
  try {
    const res = await drive.files.get({
      fileId: pastaId,
      fields: "id,trashed",
      supportsAllDrives: true,
    });
    return Boolean(res.data.id) && res.data.trashed !== true;
  } catch {
    return false;
  }
}

export async function buscarPastaPorNome(
  drive: drive_v3.Drive,
  parentId: string,
  nome: string
) {
  const consulta = [
    `'${escaparConsultaDrive(parentId)}' in parents`,
    `name='${escaparConsultaDrive(nome)}'`,
    `mimeType='${GOOGLE_DRIVE_MIME_FOLDER}'`,
    "trashed=false",
  ].join(" and ");

  const resposta = await drive.files.list({
    q: consulta,
    fields: "files(id,name)",
    pageSize: 5,
    ...opcoesDriveCompartilhado(),
  });

  return resposta.data.files?.[0]?.id ?? null;
}

export async function obterOuCriarPastaDrive(
  drive: drive_v3.Drive,
  parentId: string,
  nome: string
) {
  const chaveCache = `${parentId}:${nome}`;
  const emCache = cachePastasDrive().get(chaveCache);
  if (emCache) return emCache;

  const existente = await buscarPastaPorNome(drive, parentId, nome);
  if (existente) {
    cachePastasDrive().set(chaveCache, existente);
    return existente;
  }

  const criada = await drive.files
    .create({
      requestBody: {
        name: nome,
        mimeType: GOOGLE_DRIVE_MIME_FOLDER,
        parents: [parentId],
      },
      fields: "id",
      supportsAllDrives: true,
    })
    .catch((err) => {
      throw traduzirErroGoogleDrive(err);
    });

  const id = criada.data.id;
  if (!id) throw new Error("Não foi possível criar a pasta no Google Drive.");

  cachePastasDrive().set(chaveCache, id);
  return id;
}

export async function listarPastasFilhasDrive(
  drive: drive_v3.Drive,
  parentId: string
) {
  const pastas: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const resposta = await drive.files.list({
      q: [
        `'${escaparConsultaDrive(parentId)}' in parents`,
        `mimeType='${GOOGLE_DRIVE_MIME_FOLDER}'`,
        "trashed=false",
      ].join(" and "),
      fields: "nextPageToken, files(id,name)",
      pageSize: 100,
      pageToken,
      ...opcoesDriveCompartilhado(),
    });
    for (const pasta of resposta.data.files ?? []) {
      if (pasta.id && pasta.name) {
        pastas.push({ id: pasta.id, name: pasta.name });
      }
    }
    pageToken = resposta.data.nextPageToken ?? undefined;
  } while (pageToken);
  return pastas;
}

async function pastaTemFilhaComNome(
  drive: drive_v3.Drive,
  pastaId: string,
  nome: string
) {
  return Boolean(await buscarPastaPorNome(drive, pastaId, nome));
}

/**
 * A pasta da empresa no Drive é a que já tem `uploads` (ex.: denteart-1).
 * Nunca abre outra pelo nome fantasia — o backup nasce ao lado dos anexos.
 */
export async function resolverPastaEmpresaGoogleDrive(
  drive: drive_v3.Drive,
  slug: string,
  nomeEmpresa?: string
) {
  const pastaRaizId = await resolverPastaRaizGoogleDrive(drive);
  if (!pastaRaizId) {
    throw new Error("Pasta raiz do Google Drive indisponível.");
  }

  if (await pastaTemFilhaComNome(drive, pastaRaizId, "uploads")) {
    return {
      pastaEmpresaId: pastaRaizId,
      pastaEmpresaNome: normalizarSlugEmpresaDrive(slug) || slug,
      pastaRaizId,
    };
  }

  const filhas = await listarPastasFilhasDrive(drive, pastaRaizId);
  const comUploads: { id: string; name: string }[] = [];
  for (const pasta of filhas) {
    if (await pastaTemFilhaComNome(drive, pasta.id, "uploads")) {
      comUploads.push(pasta);
    }
  }

  const candidatos = new Set(
    candidatosNomePastaEmpresaDrive(slug, nomeEmpresa).map((nome) => nome.toLowerCase())
  );
  const peloSlug = comUploads.find((pasta) => candidatos.has(pasta.name.toLowerCase()));
  if (peloSlug) {
    return {
      pastaEmpresaId: peloSlug.id,
      pastaEmpresaNome: peloSlug.name,
      pastaRaizId,
    };
  }

  if (comUploads.length === 1) {
    return {
      pastaEmpresaId: comUploads[0].id,
      pastaEmpresaNome: comUploads[0].name,
      pastaRaizId,
    };
  }

  const existente = filhas.find((pasta) => candidatos.has(pasta.name.toLowerCase()));
  if (existente) {
    return {
      pastaEmpresaId: existente.id,
      pastaEmpresaNome: existente.name,
      pastaRaizId,
    };
  }

  const nomeCriar = normalizarSlugEmpresaDrive(slug) || slug;
  const pastaEmpresaId = await obterOuCriarPastaDrive(drive, pastaRaizId, nomeCriar);
  return { pastaEmpresaId, pastaEmpresaNome: nomeCriar, pastaRaizId };
}

export function pastaDriveJaEhRaizBackup(
  nomeAtual?: string | null,
  nomeRaiz?: string | null
) {
  const atual = (nomeAtual || "").trim().toLowerCase();
  const raiz = (nomeRaiz || nomePastaRaizGoogleDrive()).trim().toLowerCase();
  return Boolean(atual && raiz && atual === raiz);
}

export async function resolverPastaRaizGoogleDrive(drive: drive_v3.Drive) {
  const parentCompartilhado = pastaRaizGoogleDriveId();
  if (!parentCompartilhado) return null;

  const nomeRaiz = nomePastaRaizGoogleDrive();
  const chaveCache = `root:${parentCompartilhado}:${nomeRaiz}`;
  const emCache = cachePastasDrive().get(chaveCache);
  if (emCache) return emCache;

  try {
    const meta = await drive.files.get({
      fileId: parentCompartilhado,
      fields: "id,name,trashed,mimeType",
      supportsAllDrives: true,
    });
    if (
      meta.data.id &&
      meta.data.trashed !== true &&
      pastaDriveJaEhRaizBackup(meta.data.name, nomeRaiz)
    ) {
      cachePastasDrive().set(chaveCache, meta.data.id);
      return meta.data.id;
    }
  } catch {
    /* FOLDER_ID pode ser só o parent; segue criando/buscando a raiz */
  }

  const existenteNaRaiz = await buscarPastaPorNome(
    drive,
    parentCompartilhado,
    nomeRaiz
  );
  if (existenteNaRaiz) {
    cachePastasDrive().set(chaveCache, existenteNaRaiz);
    return existenteNaRaiz;
  }

  const criada = await obterOuCriarPastaDrive(
    drive,
    parentCompartilhado,
    nomeRaiz
  );
  cachePastasDrive().set(chaveCache, criada);
  return criada;
}

export function normalizarSlugEmpresaDrive(empresaSlug: string) {
  return empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nomePastaEmpresaDrive(slug: string, nomeEmpresa?: string) {
  return nomePastaBackupEmpresa(slug, nomeEmpresa);
}

/** Nomes possíveis da pasta da empresa no Drive. Slug primeiro (é o que os anexos criam). */
export function candidatosNomePastaEmpresaDrive(
  slug: string,
  nomeEmpresa?: string
) {
  const nomes: string[] = [];
  const adicionar = (valor?: string | null) => {
    const nome = (valor || "").trim();
    if (!nome) return;
    if (!nomes.some((atual) => atual.toLowerCase() === nome.toLowerCase())) {
      nomes.push(nome);
    }
  };
  const slugNorm = normalizarSlugEmpresaDrive(slug);
  adicionar(slugNorm);
  adicionar(slug);
  adicionar(nomePastaBackupEmpresa(slugNorm));
  adicionar(nomePastaBackupEmpresa(slug, nomeEmpresa));
  adicionar(nomeEmpresa);
  return nomes;
}

export function limparCachePastasGoogleDrive() {
  cachePastasDrive().clear();
}

/** Mensagens amigáveis para erros comuns da API Drive. */
export function traduzirErroGoogleDrive(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const extra =
    typeof err === "object" && err && "response" in err
      ? JSON.stringify(
          (err as { response?: { data?: unknown } }).response?.data ?? {}
        )
      : "";
  const texto = `${msg} ${extra}`;

  if (/invalid_grant|Token has been expired or revoked|invalid_rapt/i.test(texto)) {
    return new Error(
      "Google Drive: refresh_token expirado ou revogado. Gere outro com " +
        "npm run uploads:gdrive-token e atualize GOOGLE_DRIVE_REFRESH_TOKEN " +
        "(e o arquivo .gdrive-refresh-token, se existir)."
    );
  }

  if (
    /Service Accounts do not have storage quota|storageQuotaExceeded|does not have storage quota/i.test(
      texto
    )
  ) {
    return new Error(
      'Google Drive: service account não grava no "Meu Drive". ' +
        "Sem Google Workspace, configure OAuth da sua conta Google: " +
        "GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN " +
        "(npm run uploads:gdrive-token). Guia: deploy/GOOGLE-DRIVE-UPLOADS.md"
    );
  }

  if (/insufficientPermissions|The user does not have sufficient permissions/i.test(texto)) {
    return new Error(
      "Google Drive: sem permissão na pasta. Confira GOOGLE_DRIVE_FOLDER_ID e se a conta OAuth é dona da pasta."
    );
  }

  return err instanceof Error ? err : new Error(msg);
}

/** Prefixo persistido em ArquivoUpload.remotePath. */
export const GDRIVE_REMOTE_PREFIX = "gdrive:";

export function montarRemotePathGdrive(fileId: string) {
  return `${GDRIVE_REMOTE_PREFIX}${fileId.trim()}`;
}

export function extrairFileIdGdrive(remotePath?: string | null): string | null {
  const raw = (remotePath ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith(GDRIVE_REMOTE_PREFIX)) {
    const id = raw.slice(GDRIVE_REMOTE_PREFIX.length).trim();
    return id || null;
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw) && !raw.includes("/")) {
    return raw;
  }
  return null;
}
