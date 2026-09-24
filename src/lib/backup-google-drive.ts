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
import {
  executarSemRls,
  prisma,
  runWithTenantContext,
} from "@/lib/db";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";
import {
  buscarPastaPorNome,
  criarClienteGoogleDrive,
  escaparConsultaDrive,
  googleDriveStorageConfigurado,
  nomePastaRaizGoogleDrive,
  opcoesDriveCompartilhado,
  pastaDriveExiste,
  pastaRaizGoogleDriveId,
  resolverPastaRaizGoogleDrive,
  traduzirErroGoogleDrive,
} from "@/lib/google-drive-shared";
import {
  baixarArquivoPorNomeNaPastaGoogleDrive,
  excluirArquivosPorNomeNaPastaGoogleDrive,
  garantirPastaBackupsEmpresaGoogleDrive,
  listarArquivosJsonNaPastaGoogleDrive,
  uploadBufferParaPastaGoogleDrive,
} from "@/lib/google-drive-uploads";

export type StatusGoogleDriveBackup = {
  habilitado: boolean;
  configurado: boolean;
  pastaRaizId: string | null;
  pastaRaizNome: string;
  retencaoDias: number | null;
};

function flagEnvBackup(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

function flagDesligaBackup(valor: string) {
  return valor === "0" || valor === "false" || valor === "no" || valor === "off";
}

function flagLigaBackup(valor: string) {
  return valor === "1" || valor === "true" || valor === "yes" || valor === "on";
}

/** Réplica no Drive: desliga só com false explícito; se a flag faltar, usa as mesmas credenciais dos anexos. */
export function googleDriveBackupHabilitado() {
  carregarEnvArquivoRuntime();
  const bruto = flagEnvBackup(
    envRuntime("GOOGLE_DRIVE_BACKUP_ENABLED") ||
      process.env.GOOGLE_DRIVE_BACKUP_ENABLED
  );
  if (flagDesligaBackup(bruto)) return false;
  if (flagLigaBackup(bruto)) return true;
  return googleDriveStorageConfigurado();
}

export function pastaRaizGoogleDriveBackup() {
  return pastaRaizGoogleDriveId();
}

export function nomePastaRaizGoogleDriveBackup() {
  return nomePastaRaizGoogleDrive();
}

export function retencaoGoogleDriveBackupDias() {
  carregarEnvArquivoRuntime();
  const bruto =
    envRuntime("GOOGLE_DRIVE_RETENTION_DAYS") ||
    process.env.GOOGLE_DRIVE_RETENTION_DAYS?.trim() ||
    "";
  if (!bruto) return null;
  const dias = Number.parseInt(bruto, 10);
  return Number.isFinite(dias) && dias > 0 ? dias : null;
}

export function statusGoogleDriveBackup(): StatusGoogleDriveBackup {
  const habilitado = googleDriveBackupHabilitado();
  return {
    habilitado,
    configurado: habilitado && googleDriveStorageConfigurado(),
    pastaRaizId: pastaRaizGoogleDriveBackup(),
    pastaRaizNome: nomePastaRaizGoogleDriveBackup(),
    retencaoDias: retencaoGoogleDriveBackupDias(),
  };
}

export function caminhoDriveEmpresa(slug: string, nome?: string) {
  const status = statusGoogleDriveBackup();
  const pastaLocal = caminhoRelativoPastaBackupEmpresa(slug, nome);
  const pastaEmpresa =
    pastaLocal.split("/").pop() ?? nomePastaBackupEmpresa(slug, nome);
  return `${status.pastaRaizNome}/${pastaEmpresa}/backups`;
}

async function nomeEmpresaBackup(empresaId: string, slug: string, nome?: string) {
  const direto = nome?.trim();
  if (direto) return direto;
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { nome: true },
  });
  return empresa?.nome?.trim() || slug;
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

/** Garante Lab_Protese_Backups/{Empresa}/backups no Drive. */
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

  const nomeEmpresa = await nomeEmpresaBackup(params.empresaId, params.slug, params.nome);
  const pastaEmpresaNome = nomePastaBackupEmpresa(params.slug, nomeEmpresa);
  const caminhoDrive = caminhoDriveEmpresa(params.slug, nomeEmpresa);

  try {
    const config = await carregarConfigBackupAutomatico(params.empresaId);
    const pastaBackupsId = await comRetryDrive(() =>
      garantirPastaBackupsEmpresaGoogleDrive(params.slug, nomeEmpresa)
    );
    const criada = config.pastaDriveId !== pastaBackupsId;

    if (criada) {
      await registrarPastaDriveEmpresa(
        params.empresaId,
        pastaBackupsId,
        pastaEmpresaNome
      );
      console.log(`[backup-drive] pasta criada: ${caminhoDrive} (${pastaBackupsId})`);
    }

    return {
      ok: true,
      pastaId: pastaBackupsId,
      pastaNome: pastaEmpresaNome,
      caminhoDrive,
      criada,
    };
  } catch (erro) {
    const traduzido = traduzirErroGoogleDrive(erro);
    const mensagem = traduzido.message || "Falha ao criar pasta no Google Drive.";
    console.error(`[backup-drive] ${params.slug}: pasta`, erro);
    return { ok: false, erro: mensagem };
  }
}

/** Cria/atualiza pastas no Drive para todas as empresas ativas. */
export async function sincronizarPastasDriveEmpresasAtivas() {
  if (!googleDriveBackupHabilitado()) return;

  const empresas = await executarSemRls((tx) =>
    tx.empresa.findMany({
      where: { status: "ativo" },
      select: { id: true, slug: true, nome: true },
      orderBy: { nome: "asc" },
    })
  );

  for (const empresa of empresas) {
    const resultado = await runWithTenantContext(empresa.id, () =>
      garantirPastaDriveEmpresa({
        empresaId: empresa.id,
        slug: empresa.slug,
        nome: empresa.nome,
      })
    );
    if (!resultado.ok && resultado.erro && resultado.erro !== "desativado") {
      console.error(`[backup-drive] ${empresa.slug}: pasta ${resultado.erro}`);
    } else if (resultado.ok && resultado.criada) {
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

function erroDriveNaoRecuperavel(erro: unknown) {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return /invalid_grant|nao_configurado|desativado|insufficientPermissions|não configurado|sem permissão|storage quota|refresh_token expirado/i.test(
    msg
  );
}

async function comRetryDrive<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i += 1) {
    try {
      return await fn();
    } catch (erro) {
      ultimo = traduzirErroGoogleDrive(erro);
      if (erroDriveNaoRecuperavel(ultimo) || i === tentativas - 1) {
        throw ultimo;
      }
      console.warn(
        `[backup-drive] tentativa ${i + 1} falhou, repetindo…`,
        ultimo instanceof Error ? ultimo.message : ultimo
      );
      await new Promise((resolver) => setTimeout(resolver, 400 * 2 ** i));
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

function mensagemErroDriveObrigatorio(erro?: string) {
  if (erro === "desativado") {
    return "Backup no Google Drive está desligado (GOOGLE_DRIVE_BACKUP_ENABLED=false).";
  }
  if (erro === "nao_configurado" || erro === "pasta_indisponivel") {
    return "Google Drive não configurado. Defina GOOGLE_DRIVE_FOLDER_ID e o OAuth dos anexos.";
  }
  return erro || "Falha ao enviar o backup para o Google Drive.";
}

/** Envia o JSON de backup em memória para {Empresa}/backups no Google Drive. */
export async function uploadBackupParaGoogleDrive(params: {
  empresaId: string;
  slug: string;
  nome?: string;
  nomeArquivo: string;
  conteudo: Buffer | string;
}): Promise<ResultadoUploadGoogleDrive> {
  const pasta = await garantirPastaDriveEmpresa({
    empresaId: params.empresaId,
    slug: params.slug,
    nome: params.nome,
  });

  if (!pasta.ok || !pasta.pastaId) {
    return {
      ok: false,
      erro: mensagemErroDriveObrigatorio(pasta.erro ?? "pasta_indisponivel"),
    };
  }

  const pastaId = pasta.pastaId;
  const nomeArquivo = params.nomeArquivo.trim();
  const caminhoDrive = `${pasta.caminhoDrive}/${nomeArquivo}`;
  const bytes = Buffer.isBuffer(params.conteudo)
    ? params.conteudo
    : Buffer.from(params.conteudo, "utf8");

  try {
    const arquivoId = await comRetryDrive(() =>
      uploadBufferParaPastaGoogleDrive(
        pastaId,
        bytes,
        nomeArquivo,
        "application/json"
      )
    );

    const retencao = retencaoGoogleDriveBackupDias();
    if (retencao) {
      const drive = await criarClienteGoogleDrive();
      if (drive) {
        await limparArquivosAntigosDrive(drive, pasta.pastaId, retencao);
      }
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
    const traduzido = traduzirErroGoogleDrive(erro);
    const mensagem = traduzido.message || "Falha ao enviar para o Google Drive.";
    console.error(`[backup-drive] ${params.slug}:`, erro);

    await registrarUploadDriveBackupAutomatico(params.empresaId, {
      ultimoUploadDriveErro: mensagem,
    }).catch(() => undefined);

    return { ok: false, erro: mensagem };
  }
}

export async function listarArquivosBackupEmpresaGoogleDrive(params: {
  empresaId: string;
  slug: string;
  nome?: string;
}) {
  const pasta = await garantirPastaDriveEmpresa(params);
  if (!pasta.ok || !pasta.pastaId) {
    if (pasta.erro === "desativado" || pasta.erro === "nao_configurado") {
      return [];
    }
    throw new Error(mensagemErroDriveObrigatorio(pasta.erro));
  }
  return listarArquivosJsonNaPastaGoogleDrive(pasta.pastaId);
}

export async function lerArquivoBackupEmpresaGoogleDrive(params: {
  empresaId: string;
  slug: string;
  nome?: string;
  nomeArquivo: string;
}) {
  const pasta = await garantirPastaDriveEmpresa(params);
  if (!pasta.ok || !pasta.pastaId) {
    throw new Error(mensagemErroDriveObrigatorio(pasta.erro));
  }
  const bytes = await baixarArquivoPorNomeNaPastaGoogleDrive(
    pasta.pastaId,
    params.nomeArquivo
  );
  return bytes.toString("utf8");
}

export async function excluirArquivosBackupEmpresaGoogleDrive(params: {
  empresaId: string;
  slug: string;
  nome?: string;
  nomes: string[];
}) {
  const pasta = await garantirPastaDriveEmpresa({
    empresaId: params.empresaId,
    slug: params.slug,
    nome: params.nome,
  });
  if (!pasta.ok || !pasta.pastaId) {
    throw new Error(mensagemErroDriveObrigatorio(pasta.erro));
  }
  return excluirArquivosPorNomeNaPastaGoogleDrive(pasta.pastaId, params.nomes);
}

export function exigirGoogleDriveBackupPronto() {
  const status = statusGoogleDriveBackup();
  if (!status.habilitado) {
    throw new Error(mensagemErroDriveObrigatorio("desativado"));
  }
  if (!status.configurado) {
    throw new Error(mensagemErroDriveObrigatorio("nao_configurado"));
  }
  return status;
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

  const drive = await criarClienteGoogleDrive();
  if (!drive) {
    return { ok: false, erro: "credenciais_invalidas" };
  }

  const nomeEmpresa = await nomeEmpresaBackup(params.empresaId, params.slug, params.nome);
  const pastaEmpresaNome = nomePastaBackupEmpresa(params.slug, nomeEmpresa);

  try {
    const pastaRaizId = await resolverPastaRaizGoogleDrive(drive);
    if (!pastaRaizId) {
      return { ok: false, erro: "pasta_raiz_indisponivel" };
    }

    const pastaEmpresaId =
      (await buscarPastaPorNome(drive, pastaRaizId, pastaEmpresaNome)) ?? null;

    const config = await carregarConfigBackupAutomatico(params.empresaId);
    if (config.pastaDriveId && config.pastaDriveId !== pastaEmpresaId) {
      try {
        if (await pastaDriveExiste(drive, config.pastaDriveId)) {
          await drive.files.delete({
            fileId: config.pastaDriveId,
            supportsAllDrives: true,
          });
        }
      } catch {
        /* pasta backups/ some junto da empresa */
      }
    }

    if (!pastaEmpresaId) {
      return { ok: true };
    }

    await drive.files.delete({
      fileId: pastaEmpresaId,
      supportsAllDrives: true,
    });

    console.log(`[backup-drive] pasta removida: ${pastaEmpresaNome} (${pastaEmpresaId})`);
    return { ok: true, pastaId: pastaEmpresaId };
  } catch (erro) {
    const traduzido = traduzirErroGoogleDrive(erro);
    const mensagem = traduzido.message || "Falha ao excluir pasta no Google Drive.";
    console.error(`[backup-drive] excluir ${params.slug}:`, erro);
    return { ok: false, erro: mensagem };
  }
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
