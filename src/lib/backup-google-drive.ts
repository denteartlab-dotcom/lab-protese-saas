import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import {
  caminhoRelativoPastaBackupEmpresa,
  nomePastaBackupEmpresa,
} from "@/lib/backup-empresa-pasta";
import {
  carregarConfigBackupAutomatico,
  registrarPastaDriveEmpresa,
  registrarUploadDriveBackupAutomatico,
  type BackupAutomaticoConfig,
} from "@/lib/backup-automatico-config";
import { prisma } from "@/lib/db";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const MIME_JSON = "application/json";
const PASTA_RAIZ_PADRAO = "Lab_Protese_Backups";

const cachePastasDrive = new Map<string, string>();

type CredenciaisServiceAccount = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

export type StatusGoogleDriveBackup = {
  habilitado: boolean;
  configurado: boolean;
  pastaRaizId: string | null;
  pastaRaizNome: string;
  retencaoDias: number | null;
};

function flagAtiva(valor?: string | null) {
  const flag = valor?.trim().toLowerCase();
  if (!flag) return false;
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}

export function googleDriveBackupHabilitado() {
  return flagAtiva(process.env.GOOGLE_DRIVE_BACKUP_ENABLED);
}

export function pastaRaizGoogleDriveBackup() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null;
}

export function nomePastaRaizGoogleDriveBackup() {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME?.trim() || PASTA_RAIZ_PADRAO;
}

export function retencaoGoogleDriveBackupDias() {
  const bruto = process.env.GOOGLE_DRIVE_RETENTION_DAYS?.trim();
  if (!bruto) return null;
  const dias = Number.parseInt(bruto, 10);
  return Number.isFinite(dias) && dias > 0 ? dias : null;
}

export function statusGoogleDriveBackup(): StatusGoogleDriveBackup {
  const pastaRaizId = pastaRaizGoogleDriveBackup();
  const habilitado = googleDriveBackupHabilitado();
  const temCredencial =
    Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim()) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());

  return {
    habilitado,
    configurado: habilitado && Boolean(pastaRaizId) && temCredencial,
    pastaRaizId,
    pastaRaizNome: nomePastaRaizGoogleDriveBackup(),
    retencaoDias: retencaoGoogleDriveBackupDias(),
  };
}

async function lerCredenciaisServiceAccount(): Promise<CredenciaisServiceAccount | null> {
  const inline = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as CredenciaisServiceAccount;
    } catch {
      try {
        const decodificado = Buffer.from(inline, "base64").toString("utf8");
        return JSON.parse(decodificado) as CredenciaisServiceAccount;
      } catch {
        console.error("[backup-drive] GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON inválido.");
        return null;
      }
    }
  }

  const arquivo = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!arquivo) return null;

  try {
    const conteudo = await readFile(arquivo, "utf8");
    return JSON.parse(conteudo) as CredenciaisServiceAccount;
  } catch (erro) {
    console.error("[backup-drive] falha ao ler GOOGLE_APPLICATION_CREDENTIALS:", erro);
    return null;
  }
}

async function criarClienteDrive() {
  const credenciais = await lerCredenciaisServiceAccount();
  if (!credenciais?.client_email || !credenciais.private_key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: credenciais,
    scopes: SCOPES,
  });

  return google.drive({ version: "v3", auth });
}

function escaparConsultaDrive(valor: string) {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function opcoesDriveCompartilhado() {
  return {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  } as const;
}

async function pastaDriveExiste(drive: drive_v3.Drive, pastaId: string) {
  try {
    await drive.files.get({
      fileId: pastaId,
      fields: "id,trashed",
      supportsAllDrives: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function buscarPastaPorNome(
  drive: drive_v3.Drive,
  parentId: string,
  nome: string
) {
  const consulta = [
    `'${escaparConsultaDrive(parentId)}' in parents`,
    `name='${escaparConsultaDrive(nome)}'`,
    "mimeType='application/vnd.google-apps.folder'",
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

async function obterOuCriarPastaDrive(
  drive: drive_v3.Drive,
  parentId: string,
  nome: string
) {
  const chaveCache = `${parentId}:${nome}`;
  const emCache = cachePastasDrive.get(chaveCache);
  if (emCache && (await pastaDriveExiste(drive, emCache))) {
    return emCache;
  }

  const existente = await buscarPastaPorNome(drive, parentId, nome);
  if (existente) {
    cachePastasDrive.set(chaveCache, existente);
    return existente;
  }

  const criada = await drive.files.create({
    requestBody: {
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const id = criada.data.id;
  if (!id) throw new Error("Não foi possível criar a pasta no Google Drive.");

  cachePastasDrive.set(chaveCache, id);
  console.log(`[backup-drive] pasta criada: ${nome} (${id})`);
  return id;
}

async function resolverPastaRaizDrive(drive: drive_v3.Drive) {
  const parentCompartilhado = pastaRaizGoogleDriveBackup();
  if (!parentCompartilhado) return null;

  const nomeRaiz = nomePastaRaizGoogleDriveBackup();
  const chaveCache = `root:${parentCompartilhado}:${nomeRaiz}`;
  const emCache = cachePastasDrive.get(chaveCache);
  if (emCache && (await pastaDriveExiste(drive, emCache))) {
    return emCache;
  }

  const existenteNaRaiz = await buscarPastaPorNome(drive, parentCompartilhado, nomeRaiz);
  if (existenteNaRaiz) {
    cachePastasDrive.set(chaveCache, existenteNaRaiz);
    return existenteNaRaiz;
  }

  const criada = await obterOuCriarPastaDrive(drive, parentCompartilhado, nomeRaiz);
  cachePastasDrive.set(chaveCache, criada);
  return criada;
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

async function enviarArquivoDrive(
  drive: drive_v3.Drive,
  parentId: string,
  caminhoArquivo: string,
  nomeArquivo: string
) {
  const existente = await buscarArquivoPorNome(drive, parentId, nomeArquivo);
  const media = {
    mimeType: MIME_JSON,
    body: createReadStream(caminhoArquivo),
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
      parents: [parentId],
    },
    media,
    fields: "id",
    supportsAllDrives: true,
  });

  const id = criado.data.id;
  if (!id) throw new Error("Upload no Google Drive não retornou ID do arquivo.");
  return id;
}

async function limparArquivosAntigosDrive(
  drive: drive_v3.Drive,
  pastaEmpresaId: string,
  retencaoDias: number
) {
  const limite = Date.now() - retencaoDias * 24 * 60 * 60 * 1000;
  const consulta = [
    `'${escaparConsultaDrive(pastaEmpresaId)}' in parents`,
    "trashed=false",
    "mimeType!='application/vnd.google-apps.folder'",
  ].join(" and ");

  let pageToken: string | undefined;
  do {
    const resposta = await drive.files.list({
      q: consulta,
      fields: "nextPageToken, files(id,name,modifiedTime)",
      pageSize: 100,
      pageToken,
      ...opcoesDriveCompartilhado(),
    });

    for (const arquivo of resposta.data.files ?? []) {
      if (!arquivo.id || !arquivo.modifiedTime) continue;
      const modificado = new Date(arquivo.modifiedTime).getTime();
      if (Number.isNaN(modificado) || modificado >= limite) continue;
      try {
        await drive.files.delete({
          fileId: arquivo.id,
          supportsAllDrives: true,
        });
      } catch (erro) {
        console.warn(
          `[backup-drive] falha ao remover ${arquivo.name ?? arquivo.id}:`,
          erro
        );
      }
    }

    pageToken = resposta.data.nextPageToken ?? undefined;
  } while (pageToken);
}

export type ResultadoPastaDriveEmpresa = {
  ok: boolean;
  pastaId?: string;
  pastaNome?: string;
  caminhoDrive?: string;
  criada?: boolean;
  erro?: string;
};

/** Garante pasta da empresa no Drive (mesmo nome usado na VPS: backups/{Empresa}/). */
export async function garantirPastaDriveEmpresa(params: {
  empresaId: string;
  slug: string;
  nome?: string;
}): Promise<ResultadoPastaDriveEmpresa> {
  const status = statusGoogleDriveBackup();
  if (!status.habilitado) {
    return { ok: false, erro: "desativado" };
  }
  if (!status.configurado || !status.pastaRaizId) {
    return { ok: false, erro: "nao_configurado" };
  }

  const drive = await criarClienteDrive();
  if (!drive) {
    return { ok: false, erro: "credenciais_invalidas" };
  }

  let nomeEmpresa = params.nome?.trim();
  if (!nomeEmpresa) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: params.empresaId },
      select: { nome: true },
    });
    nomeEmpresa = empresa?.nome?.trim() || params.slug;
  }

  const pastaEmpresaNome = nomePastaBackupEmpresa(params.slug, nomeEmpresa);
  const caminhoDrive = `${status.pastaRaizNome}/${pastaEmpresaNome}`;

  try {
    const config = await carregarConfigBackupAutomatico(params.empresaId);
    if (
      config.pastaDriveId &&
      config.pastaDriveNome === pastaEmpresaNome &&
      (await pastaDriveExiste(drive, config.pastaDriveId))
    ) {
      return {
        ok: true,
        pastaId: config.pastaDriveId,
        pastaNome: pastaEmpresaNome,
        caminhoDrive,
        criada: false,
      };
    }

    const pastaRaizId = await resolverPastaRaizDrive(drive);
    if (!pastaRaizId) {
      return { ok: false, erro: "pasta_raiz_indisponivel" };
    }

    const antes = await buscarPastaPorNome(drive, pastaRaizId, pastaEmpresaNome);
    const pastaEmpresaId = await obterOuCriarPastaDrive(
      drive,
      pastaRaizId,
      pastaEmpresaNome
    );

    await registrarPastaDriveEmpresa(
      params.empresaId,
      pastaEmpresaId,
      pastaEmpresaNome
    );

    return {
      ok: true,
      pastaId: pastaEmpresaId,
      pastaNome: pastaEmpresaNome,
      caminhoDrive,
      criada: !antes,
    };
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha ao criar pasta no Google Drive.";
    console.error(`[backup-drive] ${params.slug}: pasta`, erro);
    return { ok: false, erro: mensagem };
  }
}

/** Cria/atualiza pastas no Drive para todas as empresas ativas. */
export async function sincronizarPastasDriveEmpresasAtivas() {
  if (!googleDriveBackupHabilitado()) return;

  const empresas = await prisma.empresa.findMany({
    where: { status: "ativo" },
    select: { id: true, slug: true, nome: true },
    orderBy: { nome: "asc" },
  });

  for (const empresa of empresas) {
    const resultado = await garantirPastaDriveEmpresa({
      empresaId: empresa.id,
      slug: empresa.slug,
      nome: empresa.nome,
    });
    if (resultado.ok && resultado.criada) {
      console.log(
        `[backup-drive] ${empresa.slug}: pasta pronta em ${resultado.caminhoDrive}`
      );
    }
  }
}

export type ResultadoUploadGoogleDrive = {
  ok: boolean;
  arquivoId?: string;
  pastaEmpresaId?: string;
  pastaEmpresaNome?: string;
  caminhoDrive?: string;
  erro?: string;
};

/** Envia o JSON de backup local para a pasta da empresa no Google Drive. */
export async function uploadBackupParaGoogleDrive(params: {
  empresaId: string;
  slug: string;
  nome?: string;
  caminhoArquivoLocal: string;
}): Promise<ResultadoUploadGoogleDrive> {
  const pasta = await garantirPastaDriveEmpresa({
    empresaId: params.empresaId,
    slug: params.slug,
    nome: params.nome,
  });

  if (!pasta.ok || !pasta.pastaId) {
    return { ok: false, erro: pasta.erro ?? "pasta_indisponivel" };
  }

  const drive = await criarClienteDrive();
  if (!drive) {
    return { ok: false, erro: "credenciais_invalidas" };
  }

  const nomeArquivo = path.basename(params.caminhoArquivoLocal);
  const caminhoDrive = `${pasta.caminhoDrive}/${nomeArquivo}`;

  try {
    const arquivoId = await enviarArquivoDrive(
      drive,
      pasta.pastaId,
      params.caminhoArquivoLocal,
      nomeArquivo
    );

    const retencao = retencaoGoogleDriveBackupDias();
    if (retencao) {
      await limparArquivosAntigosDrive(drive, pasta.pastaId, retencao);
    }

    await registrarUploadDriveBackupAutomatico(params.empresaId, {
      ultimoUploadDriveEm: new Date().toISOString(),
      ultimoUploadDriveArquivo: caminhoDrive,
      ultimoUploadDriveErro: null,
    });

    console.log(
      `[backup-drive] ${params.slug}: enviado ${caminhoDrive} (id ${arquivoId})`
    );

    return {
      ok: true,
      arquivoId,
      pastaEmpresaId: pasta.pastaId,
      pastaEmpresaNome: pasta.pastaNome,
      caminhoDrive,
    };
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha ao enviar para o Google Drive.";
    console.error(`[backup-drive] ${params.slug}:`, erro);

    await registrarUploadDriveBackupAutomatico(params.empresaId, {
      ultimoUploadDriveErro: mensagem,
    }).catch(() => undefined);

    return { ok: false, erro: mensagem };
  }
}

export type ResultadoExclusaoPastaDrive = {
  ok: boolean;
  pastaId?: string;
  erro?: string;
};

/** Remove a pasta da empresa no Google Drive (backup completo). */
export async function excluirPastaDriveEmpresa(params: {
  empresaId: string;
  slug: string;
  nome?: string;
}): Promise<ResultadoExclusaoPastaDrive> {
  const status = statusGoogleDriveBackup();
  if (!status.habilitado) {
    return { ok: false, erro: "desativado" };
  }
  if (!status.configurado || !status.pastaRaizId) {
    return { ok: false, erro: "nao_configurado" };
  }

  const drive = await criarClienteDrive();
  if (!drive) {
    return { ok: false, erro: "credenciais_invalidas" };
  }

  let nomeEmpresa = params.nome?.trim();
  if (!nomeEmpresa) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: params.empresaId },
      select: { nome: true },
    });
    nomeEmpresa = empresa?.nome?.trim() || params.slug;
  }

  const pastaEmpresaNome = nomePastaBackupEmpresa(params.slug, nomeEmpresa);

  try {
    const config = await carregarConfigBackupAutomatico(params.empresaId);
    let pastaId = config.pastaDriveId;

    if (pastaId && !(await pastaDriveExiste(drive, pastaId))) {
      pastaId = null;
    }

    if (!pastaId) {
      const pastaRaizId = await resolverPastaRaizDrive(drive);
      if (!pastaRaizId) {
        return { ok: false, erro: "pasta_raiz_indisponivel" };
      }
      pastaId = (await buscarPastaPorNome(drive, pastaRaizId, pastaEmpresaNome)) ?? null;
    }

    if (!pastaId) {
      return { ok: true };
    }

    await drive.files.delete({
      fileId: pastaId,
      supportsAllDrives: true,
    });

    console.log(`[backup-drive] pasta removida: ${pastaEmpresaNome} (${pastaId})`);
    return { ok: true, pastaId };
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha ao excluir pasta no Google Drive.";
    console.error(`[backup-drive] excluir ${params.slug}:`, erro);
    return { ok: false, erro: mensagem };
  }
}

export function caminhoDriveEmpresa(slug: string, nome?: string) {
  const status = statusGoogleDriveBackup();
  const pastaLocal = caminhoRelativoPastaBackupEmpresa(slug, nome);
  const pastaEmpresa = pastaLocal.split("/").pop() ?? nomePastaBackupEmpresa(slug, nome);
  return `${status.pastaRaizNome}/${pastaEmpresa}`;
}

export function textoStatusUploadDrive(
  config: Pick<
    BackupAutomaticoConfig,
    | "ultimoUploadDriveEm"
    | "ultimoUploadDriveArquivo"
    | "ultimoUploadDriveErro"
    | "pastaDriveId"
    | "pastaDriveNome"
  >,
  fuso = "America/Sao_Paulo"
) {
  if (config.ultimoUploadDriveErro) {
    return {
      tipo: "erro" as const,
      mensagem: config.ultimoUploadDriveErro,
      pastaEmpresa: config.pastaDriveNome,
    };
  }

  if (!config.ultimoUploadDriveEm) {
    return {
      tipo: "pendente" as const,
      mensagem: config.pastaDriveId
        ? "Pasta criada no Drive. Aguardando primeiro backup."
        : "Ainda não enviado para o Google Drive.",
      pastaEmpresa: config.pastaDriveNome,
    };
  }

  let formatado = config.ultimoUploadDriveEm;
  try {
    formatado = new Date(config.ultimoUploadDriveEm).toLocaleString("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    /* mantém ISO */
  }

  return {
    tipo: "ok" as const,
    mensagem: formatado,
    arquivo: config.ultimoUploadDriveArquivo,
    pastaEmpresa: config.pastaDriveNome,
  };
}
