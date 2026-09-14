/**
 * Uploads / listagem / cota no Google Drive (service account).
 * Estrutura: {raiz}/Lab_Protese_Backups/{Empresa}/uploads/{modulo}/...
 */
import { Readable } from "stream";
import type { drive_v3 } from "googleapis";
import {
  buscarPastaPorNome,
  criarClienteGoogleDrive,
  escaparConsultaDrive,
  extrairFileIdGdrive,
  googleDriveStorageConfigurado,
  limparCachePastasGoogleDrive,
  montarRemotePathGdrive,
  nomePastaEmpresaDrive,
  nomePastaRaizGoogleDrive,
  normalizarSlugEmpresaDrive,
  obterOuCriarPastaDrive,
  opcoesDriveCompartilhado,
  pastaDriveExiste,
  resolverPastaRaizGoogleDrive,
  traduzirErroGoogleDrive,
} from "@/lib/google-drive-shared";

const MODULOS_UPLOAD = [
  "os",
  "despesas",
  "receitas",
  "produtos",
  "disparos-whatsapp",
  "suporte",
] as const;

const CACHE_COTA_MS = 5 * 60_000;
const CACHE_LISTA_MS = 5 * 60_000;

export type CotaGoogleDrive = {
  total: number;
  used: number;
  remaining: number;
  state?: string;
};

export type ArquivoUploadsEmpresaGdrive = {
  name: string;
  remotePath: string;
  fileId: string;
  bytes: number;
  lastModified: string;
  modulo: string;
};

const globalGdrive = globalThis as typeof globalThis & {
  __gdriveQuota?: { atMs: number; data: CotaGoogleDrive };
  __gdriveListaUploads?: Map<
    string,
    { atMs: number; arquivos: ArquivoUploadsEmpresaGdrive[] }
  >;
  __gdriveUsoAjuste?: number;
};

export function googleDriveUploadsConfigurado() {
  return googleDriveStorageConfigurado();
}

function exigirDrive(drive: drive_v3.Drive | null): drive_v3.Drive {
  if (!drive) {
    throw new Error(
      "Google Drive não configurado. Defina GOOGLE_DRIVE_FOLDER_ID e GOOGLE_APPLICATION_CREDENTIALS (ou GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)."
    );
  }
  return drive;
}

async function garantirPastaEmpresaUploads(
  drive: drive_v3.Drive,
  slug: string,
  nomeEmpresa?: string
) {
  const pastaRaizId = await resolverPastaRaizGoogleDrive(drive);
  if (!pastaRaizId) {
    throw new Error("Pasta raiz do Google Drive indisponível.");
  }
  const pastaEmpresaNome = nomePastaEmpresaDrive(slug, nomeEmpresa);
  const pastaEmpresaId = await obterOuCriarPastaDrive(
    drive,
    pastaRaizId,
    pastaEmpresaNome
  );
  const pastaUploadsId = await obterOuCriarPastaDrive(
    drive,
    pastaEmpresaId,
    "uploads"
  );
  return { pastaEmpresaId, pastaUploadsId, pastaEmpresaNome };
}

/** Garante {Empresa}/uploads/{modulo}[/subpastas]. */
export async function garantirPastaModuloUploadGoogleDrive(
  empresaSlug: string,
  modulo: string,
  subpastas: string[] = [],
  nomeEmpresa?: string
) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const slug = normalizarSlugEmpresaDrive(empresaSlug);
  const { pastaUploadsId } = await garantirPastaEmpresaUploads(
    drive,
    slug,
    nomeEmpresa
  );
  let parent = pastaUploadsId;
  parent = await obterOuCriarPastaDrive(drive, parent, modulo);
  for (const sub of subpastas) {
    const nome = sub.trim();
    if (!nome) continue;
    parent = await obterOuCriarPastaDrive(drive, parent, nome);
  }
  return parent;
}

export function caminhoRemotoEmpresaUploads(
  empresaSlug: string,
  pasta: string,
  filename: string,
  nomeEmpresa?: string
) {
  const slug = normalizarSlugEmpresaDrive(empresaSlug);
  const empresa = nomePastaEmpresaDrive(slug, nomeEmpresa);
  const raiz = nomePastaRaizGoogleDrive();
  return `${raiz}/${empresa}/uploads/${pasta}/${filename}`.replace(/\\/g, "/");
}

export function caminhoRemotoEmpresaRaiz(
  empresaSlug: string,
  nomeEmpresa?: string
) {
  const slug = normalizarSlugEmpresaDrive(empresaSlug);
  const empresa = nomePastaEmpresaDrive(slug, nomeEmpresa);
  return `${nomePastaRaizGoogleDrive()}/${empresa}`;
}

async function buscarArquivoPorNome(
  drive: drive_v3.Drive,
  parentId: string,
  nomeArquivo: string
) {
  const consulta = [
    `'${escaparConsultaDrive(parentId)}' in parents`,
    `name='${escaparConsultaDrive(nomeArquivo)}'`,
    "trashed=false",
  ].join(" and ");

  const resposta = await drive.files.list({
    q: consulta,
    fields: "files(id,name)",
    pageSize: 1,
    ...opcoesDriveCompartilhado(),
  });

  return resposta.data.files?.[0]?.id ?? null;
}

function bufferParaStream(bytes: Buffer) {
  return Readable.from(bytes);
}

/**
 * Envia bytes e retorna remotePath `gdrive:{fileId}`.
 * `caminhoLogico` é só para log / criar pastas (ex.: .../uploads/os/arquivo.png).
 */
export async function uploadBytesGoogleDrive(
  caminhoLogico: string,
  bytes: Buffer,
  mimeType?: string,
  opcoes?: {
    empresaSlug?: string;
    nomeEmpresa?: string;
    modulo?: string;
    subpastas?: string[];
    nomeArquivo?: string;
    parentId?: string;
  }
): Promise<{ remotePath: string; fileId: string; webViewLink?: string }> {
  try {
    return await uploadBytesGoogleDriveInterno(
      caminhoLogico,
      bytes,
      mimeType,
      opcoes
    );
  } catch (err) {
    throw traduzirErroGoogleDrive(err);
  }
}

async function uploadBytesGoogleDriveInterno(
  caminhoLogico: string,
  bytes: Buffer,
  mimeType?: string,
  opcoes?: {
    empresaSlug?: string;
    nomeEmpresa?: string;
    modulo?: string;
    subpastas?: string[];
    nomeArquivo?: string;
    parentId?: string;
  }
): Promise<{ remotePath: string; fileId: string; webViewLink?: string }> {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const segmentos = caminhoLogico
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const nomeArquivo =
    opcoes?.nomeArquivo?.trim() || segmentos[segmentos.length - 1] || "arquivo";

  let parentId: string;
  if (opcoes?.parentId?.trim()) {
    parentId = opcoes.parentId.trim();
  } else if (opcoes?.empresaSlug && opcoes.modulo) {
    parentId = await garantirPastaModuloUploadGoogleDrive(
      opcoes.empresaSlug,
      opcoes.modulo,
      opcoes.subpastas ?? [],
      opcoes.nomeEmpresa
    );
  } else {
    // Resolve pasta pai a partir do caminho lógico após a raiz Lab_...
    const pastaRaizId = await resolverPastaRaizGoogleDrive(drive);
    if (!pastaRaizId) throw new Error("Pasta raiz do Google Drive indisponível.");
    const raizNome = nomePastaRaizGoogleDrive();
    let idx = 0;
    if (segmentos[0] === raizNome) idx = 1;
    parentId = pastaRaizId;
    for (; idx < segmentos.length - 1; idx++) {
      parentId = await obterOuCriarPastaDrive(drive, parentId, segmentos[idx]);
    }
  }

  const mime = mimeType || "application/octet-stream";
  const criado = await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [parentId],
    },
    media: {
      mimeType: mime,
      body: bufferParaStream(bytes),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!criado.data.id) {
    throw new Error("Upload no Google Drive não retornou ID.");
  }

  return {
    fileId: criado.data.id,
    remotePath: montarRemotePathGdrive(criado.data.id),
  };
}

export async function downloadBytesGoogleDrive(
  remotePathOuId: string
): Promise<Buffer> {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const fileId =
    extrairFileIdGdrive(remotePathOuId) || remotePathOuId.trim();
  if (!fileId) {
    throw new Error("Identificador do arquivo Google Drive inválido.");
  }

  try {
    const res = await drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" }
    );

    const data = res.data as ArrayBuffer | Buffer | string;
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (typeof data === "string") return Buffer.from(data);
    return Buffer.from(data as ArrayBuffer);
  } catch (err) {
    const status = Number(
      (err as { code?: number; response?: { status?: number } })?.code ??
        (err as { response?: { status?: number } })?.response?.status ??
        0
    );
    if (status === 404) {
      const ausente = new Error("File not found");
      (ausente as Error & { code: number }).code = 404;
      throw ausente;
    }
    throw err;
  }
}

export async function deleteItemGoogleDrive(remotePathOuId: string) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const fileId =
    extrairFileIdGdrive(remotePathOuId) || remotePathOuId.trim();
  if (!fileId) return;

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|404|File not found/i.test(msg)) return;
    throw err;
  }
  limparCacheListaUploads();
  limparCacheCotaGoogleDrive();
}

export async function deletePastaEmpresaGoogleDrive(
  empresaSlug: string,
  nomeEmpresa?: string
) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const pastaRaizId = await resolverPastaRaizGoogleDrive(drive);
  if (!pastaRaizId) return;

  const pastaEmpresaNome = nomePastaEmpresaDrive(
    normalizarSlugEmpresaDrive(empresaSlug),
    nomeEmpresa
  );
  const pastaId = await buscarPastaPorNome(
    drive,
    pastaRaizId,
    pastaEmpresaNome
  );
  if (!pastaId) return;

  await drive.files.delete({
    fileId: pastaId,
    supportsAllDrives: true,
  });
  limparCachePastasGoogleDrive();
  limparCacheListaUploads();
  limparCacheCotaGoogleDrive();
}

async function listarRecursivoUploads(
  drive: drive_v3.Drive,
  pastaId: string,
  modulo: string,
  acumulado: ArquivoUploadsEmpresaGdrive[]
) {
  let pageToken: string | undefined;
  do {
    const resposta = await drive.files.list({
      q: `'${escaparConsultaDrive(pastaId)}' in parents and trashed=false`,
      fields:
        "nextPageToken, files(id,name,mimeType,size,modifiedTime)",
      pageSize: 200,
      pageToken,
      ...opcoesDriveCompartilhado(),
    });

    for (const f of resposta.data.files ?? []) {
      if (!f.id || !f.name) continue;
      if (f.mimeType === "application/vnd.google-apps.folder") {
        await listarRecursivoUploads(drive, f.id, modulo, acumulado);
        continue;
      }
      acumulado.push({
        name: f.name,
        fileId: f.id,
        remotePath: montarRemotePathGdrive(f.id),
        bytes: Number(f.size || 0) || 0,
        lastModified: f.modifiedTime || new Date().toISOString(),
        modulo,
      });
    }

    pageToken = resposta.data.nextPageToken ?? undefined;
  } while (pageToken);
}

export async function listarArquivosUploadsEmpresaGoogleDrive(
  empresaSlug: string,
  opcoes?: { force?: boolean; nomeEmpresa?: string; empresaId?: string }
): Promise<ArquivoUploadsEmpresaGdrive[]> {
  const slug = normalizarSlugEmpresaDrive(empresaSlug);
  if (!globalGdrive.__gdriveListaUploads) {
    globalGdrive.__gdriveListaUploads = new Map();
  }
  const cache = globalGdrive.__gdriveListaUploads.get(slug);
  if (
    !opcoes?.force &&
    cache &&
    Date.now() - cache.atMs < CACHE_LISTA_MS
  ) {
    return cache.arquivos;
  }

  const drive = exigirDrive(await criarClienteGoogleDrive());
  const { pastaUploadsId } = await garantirPastaEmpresaUploads(
    drive,
    slug,
    opcoes?.nomeEmpresa
  );

  const arquivos: ArquivoUploadsEmpresaGdrive[] = [];
  for (const modulo of MODULOS_UPLOAD) {
    const pastaModuloId = await buscarPastaPorNome(
      drive,
      pastaUploadsId,
      modulo
    );
    if (!pastaModuloId) continue;
    await listarRecursivoUploads(drive, pastaModuloId, modulo, arquivos);
  }

  globalGdrive.__gdriveListaUploads.set(slug, {
    atMs: Date.now(),
    arquivos,
  });
  if (opcoes?.empresaId) {
    const { reconciliarUploadsGdriveAusentes } = await import(
      "@/lib/limpar-anexos-os-servidor"
    );
    await reconciliarUploadsGdriveAusentes(opcoes.empresaId, arquivos);
  }
  return arquivos;
}

export function limparCacheListaUploads(empresaSlug?: string) {
  if (!globalGdrive.__gdriveListaUploads) return;
  if (empresaSlug) {
    globalGdrive.__gdriveListaUploads.delete(
      normalizarSlugEmpresaDrive(empresaSlug)
    );
  } else {
    globalGdrive.__gdriveListaUploads.clear();
  }
}

export function limparCacheCotaGoogleDrive() {
  globalGdrive.__gdriveQuota = undefined;
  globalGdrive.__gdriveUsoAjuste = 0;
}

export function ajustarCotaGoogleDriveAposUpload(bytes: number) {
  if (!globalGdrive.__gdriveQuota) {
    globalGdrive.__gdriveUsoAjuste =
      (globalGdrive.__gdriveUsoAjuste ?? 0) + bytes;
    return;
  }
  const q = globalGdrive.__gdriveQuota.data;
  q.used += bytes;
  q.remaining = Math.max(0, q.total - q.used);
}

export function ajustarCotaGoogleDriveAposExclusao(bytes: number) {
  if (!globalGdrive.__gdriveQuota) {
    globalGdrive.__gdriveUsoAjuste =
      (globalGdrive.__gdriveUsoAjuste ?? 0) - bytes;
    return;
  }
  const q = globalGdrive.__gdriveQuota.data;
  q.used = Math.max(0, q.used - bytes);
  q.remaining = Math.max(0, q.total - q.used);
}

export function cotaGoogleDriveEmCache(): CotaGoogleDrive | null {
  if (
    globalGdrive.__gdriveQuota &&
    Date.now() - globalGdrive.__gdriveQuota.atMs < CACHE_COTA_MS
  ) {
    return globalGdrive.__gdriveQuota.data;
  }
  return null;
}

/**
 * Cota da conta Drive. Service account em pasta compartilhada
 * muitas vezes não expõe quota útil — o caller deve usar fallback DB.
 */
export async function obterCotaGoogleDrive(): Promise<CotaGoogleDrive | null> {
  const cache = cotaGoogleDriveEmCache();
  if (cache) return cache;

  try {
    const drive = await criarClienteGoogleDrive();
    if (!drive) return null;
    const about = await drive.about.get({
      fields: "storageQuota",
    });
    const sq = about.data.storageQuota;
    const limit = Number(sq?.limit || 0);
    const usage = Number(sq?.usage || 0);
    if (!limit || !Number.isFinite(limit)) return null;

    const ajuste = globalGdrive.__gdriveUsoAjuste ?? 0;
    const used = Math.max(0, usage + ajuste);
    const data: CotaGoogleDrive = {
      total: limit,
      used,
      remaining: Math.max(0, limit - used),
      state: limit - used < 100 * 1024 * 1024 ? "critical" : "normal",
    };
    globalGdrive.__gdriveQuota = { atMs: Date.now(), data };
    globalGdrive.__gdriveUsoAjuste = 0;
    return data;
  } catch {
    return null;
  }
}

export async function quemSouGoogleDrive(): Promise<{
  email?: string;
  configurado: boolean;
  modo?: "oauth" | "service_account";
} | null> {
  if (!googleDriveUploadsConfigurado()) {
    return { configurado: false };
  }
  try {
    const {
      modoAuthGoogleDrive,
      lerCredenciaisGoogleDriveServiceAccount,
      criarClienteGoogleDrive,
    } = await import("@/lib/google-drive-shared");
    const modo = modoAuthGoogleDrive();
    if (modo === "oauth") {
      const drive = await criarClienteGoogleDrive();
      if (drive) {
        const about = await drive.about.get({ fields: "user(emailAddress,displayName)" });
        return {
          configurado: true,
          modo: "oauth",
          email: about.data.user?.emailAddress ?? undefined,
        };
      }
      return { configurado: true, modo: "oauth" };
    }
    const cred = await lerCredenciaisGoogleDriveServiceAccount();
    return {
      configurado: true,
      modo: "service_account",
      email: cred?.client_email,
    };
  } catch {
    return { configurado: true };
  }
}

/** Garante pasta backups/ dentro da empresa (sync de arquivos de backup). */
export async function garantirPastaBackupsEmpresaGoogleDrive(
  empresaSlug: string,
  nomeEmpresa?: string
) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const slug = normalizarSlugEmpresaDrive(empresaSlug);
  const { pastaEmpresaId } = await garantirPastaEmpresaUploads(
    drive,
    slug,
    nomeEmpresa
  );
  return obterOuCriarPastaDrive(drive, pastaEmpresaId, "backups");
}

export async function uploadArquivoLocalParaPastaGoogleDrive(
  pastaId: string,
  caminhoLocal: string,
  nomeArquivo: string,
  mimeType = "application/octet-stream"
) {
  const { createReadStream } = await import("fs");
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const existente = await buscarArquivoPorNome(drive, pastaId, nomeArquivo);
  const media = {
    mimeType,
    body: createReadStream(caminhoLocal),
  };

  if (existente) {
    await drive.files.update({
      fileId: existente,
      media,
      supportsAllDrives: true,
    });
    return existente;
  }

  const criado = await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [pastaId],
    },
    media,
    fields: "id",
    supportsAllDrives: true,
  });
  if (!criado.data.id) {
    throw new Error("Falha ao enviar arquivo para o Google Drive.");
  }
  return criado.data.id;
}

/** Envia bytes direto para uma pasta do Drive (sem gravar arquivo na VPS). */
export async function uploadBufferParaPastaGoogleDrive(
  pastaId: string,
  bytes: Buffer,
  nomeArquivo: string,
  mimeType = "application/octet-stream"
) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const existente = await buscarArquivoPorNome(drive, pastaId, nomeArquivo);
  const media = {
    mimeType,
    body: bufferParaStream(bytes),
  };

  if (existente) {
    await drive.files.update({
      fileId: existente,
      media,
      supportsAllDrives: true,
    });
    return existente;
  }

  const criado = await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [pastaId],
    },
    media,
    fields: "id",
    supportsAllDrives: true,
  });
  if (!criado.data.id) {
    throw new Error("Falha ao enviar arquivo para o Google Drive.");
  }
  return criado.data.id;
}

export type ArquivoJsonPastaGoogleDrive = {
  id: string;
  nome: string;
  bytes: number;
  modificadoEm: string;
};

export async function listarArquivosJsonNaPastaGoogleDrive(pastaId: string) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const arquivos: ArquivoJsonPastaGoogleDrive[] = [];
  let pageToken: string | undefined;

  do {
    const resposta = await drive.files.list({
      q: [
        `'${escaparConsultaDrive(pastaId)}' in parents`,
        "trashed=false",
        "mimeType!='application/vnd.google-apps.folder'",
      ].join(" and "),
      fields: "nextPageToken, files(id,name,size,modifiedTime)",
      pageSize: 100,
      pageToken,
      ...opcoesDriveCompartilhado(),
    });

    for (const arquivo of resposta.data.files ?? []) {
      if (!arquivo.id || !arquivo.name?.toLowerCase().endsWith(".json")) continue;
      arquivos.push({
        id: arquivo.id,
        nome: arquivo.name,
        bytes: Number(arquivo.size || 0),
        modificadoEm: arquivo.modifiedTime || new Date().toISOString(),
      });
    }

    pageToken = resposta.data.nextPageToken ?? undefined;
  } while (pageToken);

  return arquivos.sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm));
}

export async function baixarArquivoPorNomeNaPastaGoogleDrive(
  pastaId: string,
  nomeArquivo: string
) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const id = await buscarArquivoPorNome(drive, pastaId, nomeArquivo);
  if (!id) {
    throw new Error("Arquivo de backup não encontrado no Google Drive.");
  }
  return downloadBytesGoogleDrive(id);
}

export async function excluirArquivosPorNomeNaPastaGoogleDrive(
  pastaId: string,
  nomes: string[]
) {
  const drive = exigirDrive(await criarClienteGoogleDrive());
  const excluidos: string[] = [];
  for (const nome of nomes) {
    const id = await buscarArquivoPorNome(drive, pastaId, nome);
    if (!id) continue;
    await drive.files.delete({
      fileId: id,
      supportsAllDrives: true,
    });
    excluidos.push(nome);
  }
  return excluidos;
}

export { pastaDriveExiste };
