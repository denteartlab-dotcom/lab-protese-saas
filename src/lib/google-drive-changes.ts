/**
 * O Google Drive avisa o sistema (webhook changes.watch) quando um arquivo
 * some. Sem aviso (domínio não verificado, HTTPS, etc.) consultamos a API
 * a cada minuto — a OS ainda é limpa sozinha.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomUUID, randomBytes } from "crypto";
import path from "path";
import type { drive_v3 } from "googleapis";
import { APP_URL } from "@/lib/app-url";
import { executarSemRls, runWithTenantContext } from "@/lib/db";
import {
  criarClienteGoogleDrive,
  extrairFileIdGdrive,
  flagEnvAtiva,
  GOOGLE_DRIVE_MIME_FOLDER,
  montarRemotePathGdrive,
} from "@/lib/google-drive-shared";
import { removerAnexosOsPorArquivoIds } from "@/lib/limpar-anexos-os-servidor";

export const ROTA_WEBHOOK_GOOGLE_DRIVE = "/api/google-drive/webhook";

const INTERVALO_CONSULTA_MS = 60_000;
const INTERVALO_RENOVAR_WATCH_MS = 30 * 60_000;
const WATCH_TTL_MS = 20 * 60 * 60_000;
const RENOVAR_WATCH_ANTES_MS = 4 * 60 * 60_000;

export type MudancaDrive = {
  fileId?: string | null;
  removed?: boolean | null;
  file?: {
    id?: string | null;
    trashed?: boolean | null;
    explicitlyTrashed?: boolean | null;
    mimeType?: string | null;
  } | null;
};

type EstadoWatchGdrive = {
  pageToken: string;
  channelId?: string;
  resourceId?: string;
  token?: string;
  expirationMs?: number;
};

const globalWatch = globalThis as typeof globalThis & {
  __gdriveChangesTimer?: ReturnType<typeof setInterval>;
  __gdriveWatchTimer?: ReturnType<typeof setInterval>;
  __gdriveChangesLock?: Promise<void> | null;
  __gdriveWatchIniciado?: boolean;
};

function caminhoEstadoWatch() {
  return path.join(process.cwd(), ".gdrive-changes-watch.json");
}

function intervaloConsultaMs() {
  const bruto = Number(process.env.GOOGLE_DRIVE_CHANGES_POLL_MS || "");
  if (Number.isFinite(bruto) && bruto >= 15_000) return bruto;
  return INTERVALO_CONSULTA_MS;
}

function watchHabilitado() {
  const flag = process.env.GOOGLE_DRIVE_WATCH_ENABLED;
  if (flag == null || flag.trim() === "") return true;
  return flagEnvAtiva(flag);
}

export function urlWebhookGoogleDrive(): string | null {
  const base = APP_URL.replace(/\/$/, "");
  if (!base.startsWith("https://")) return null;
  try {
    const host = new URL(base).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return null;
  } catch {
    return null;
  }
  return `${base}${ROTA_WEBHOOK_GOOGLE_DRIVE}`;
}

function lerEstadoWatch(): EstadoWatchGdrive | null {
  try {
    const arquivo = caminhoEstadoWatch();
    if (!existsSync(arquivo)) return null;
    const parsed = JSON.parse(readFileSync(arquivo, "utf8")) as EstadoWatchGdrive;
    if (!parsed?.pageToken || typeof parsed.pageToken !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function gravarEstadoWatch(estado: EstadoWatchGdrive) {
  writeFileSync(caminhoEstadoWatch(), `${JSON.stringify(estado, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function analisarMudancasDrive(changes: MudancaDrive[]): {
  fileIds: string[];
  pastaRemovida: boolean;
} {
  const ids = new Set<string>();
  let pastaRemovida = false;
  for (const change of changes) {
    const fileId = (change.fileId || change.file?.id || "").trim();
    if (!fileId) continue;
    const removido =
      change.removed === true ||
      change.file?.trashed === true ||
      change.file?.explicitlyTrashed === true;
    if (!removido) continue;
    ids.add(fileId);
    if (change.file?.mimeType === GOOGLE_DRIVE_MIME_FOLDER) {
      pastaRemovida = true;
    }
  }
  return { fileIds: [...ids], pastaRemovida };
}

export function notificacaoGoogleDriveAutorizada(params: {
  token?: string | null;
  channelId?: string | null;
}): boolean {
  const estado = lerEstadoWatch();
  const tokenRecebido = params.token?.trim() || "";
  if (!tokenRecebido || !estado?.token) return false;
  if (tokenRecebido !== estado.token) return false;
  if (estado.channelId && params.channelId?.trim()) {
    return params.channelId.trim() === estado.channelId;
  }
  return true;
}

async function exigirDrive() {
  const drive = await criarClienteGoogleDrive();
  if (!drive) {
    throw new Error("Google Drive não configurado.");
  }
  return drive;
}

async function garantirPageToken(drive: drive_v3.Drive): Promise<EstadoWatchGdrive> {
  const atual = lerEstadoWatch();
  if (atual?.pageToken) return atual;
  const inicio = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
  });
  const pageToken = inicio.data.startPageToken?.trim();
  if (!pageToken) {
    throw new Error("Google Drive não devolveu startPageToken.");
  }
  const estado: EstadoWatchGdrive = {
    ...atual,
    pageToken,
    token: atual?.token || randomBytes(24).toString("hex"),
  };
  gravarEstadoWatch(estado);
  return estado;
}

async function pararCanal(drive: drive_v3.Drive, estado: EstadoWatchGdrive) {
  if (!estado.channelId || !estado.resourceId) return;
  try {
    await drive.channels.stop({
      requestBody: {
        id: estado.channelId,
        resourceId: estado.resourceId,
      },
    });
  } catch (erro) {
    console.warn("[gdrive-watch] falha ao encerrar canal antigo:", erro);
  }
}

async function registrarWatch(drive: drive_v3.Drive): Promise<boolean> {
  if (!watchHabilitado()) return false;
  const address = urlWebhookGoogleDrive();
  if (!address) {
    console.warn(
      "[gdrive-watch] webhook precisa de HTTPS público (URL_PUBLICA_DO_APP). Usando só a consulta periódica."
    );
    return false;
  }

  const estado = await garantirPageToken(drive);
  const aindaVale =
    estado.channelId &&
    estado.resourceId &&
    estado.expirationMs &&
    estado.expirationMs - Date.now() > RENOVAR_WATCH_ANTES_MS;
  if (aindaVale) return true;

  await pararCanal(drive, estado);

  const channelId = randomUUID();
  const token = estado.token || randomBytes(24).toString("hex");
  const expiration = String(Date.now() + WATCH_TTL_MS);

  try {
    const resposta = await drive.changes.watch({
      pageToken: estado.pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address,
        token,
        expiration,
      },
    });

    gravarEstadoWatch({
      ...estado,
      pageToken: estado.pageToken,
      channelId,
      resourceId: resposta.data.resourceId || undefined,
      token,
      expirationMs: Number(resposta.data.expiration || expiration),
    });
    console.log(`[gdrive-watch] Drive avisará ${address}`);
    return true;
  } catch (erro) {
    console.warn(
      "[gdrive-watch] Drive recusou o webhook (confira verificação de domínio no Google Cloud). A OS ainda será limpa pela consulta periódica.",
      erro instanceof Error ? erro.message : erro
    );
    gravarEstadoWatch({
      pageToken: estado.pageToken,
      token,
    });
    return false;
  }
}

async function aplicarExclusoesNaOs(fileIds: string[]) {
  if (fileIds.length === 0) return 0;
  const caminhos = fileIds.flatMap((id) => [montarRemotePathGdrive(id), id]);
  const rows = await executarSemRls((tx) =>
    tx.arquivoUpload.findMany({
      where: { remotePath: { in: caminhos } },
      select: { id: true, empresaId: true, remotePath: true },
    })
  );

  const validos = rows.filter((row) => {
    const extraido = extrairFileIdGdrive(row.remotePath);
    return extraido != null && fileIds.includes(extraido);
  });
  if (validos.length === 0) return 0;

  const porEmpresa = new Map<string, string[]>();
  for (const row of validos) {
    const lista = porEmpresa.get(row.empresaId) || [];
    lista.push(row.id);
    porEmpresa.set(row.empresaId, lista);
  }

  for (const [empresaId, ids] of porEmpresa) {
    await runWithTenantContext(empresaId, async () => {
      await removerAnexosOsPorArquivoIds(empresaId, ids);
      const { prisma } = await import("@/lib/db");
      await prisma.arquivoUpload.deleteMany({
        where: { empresaId, id: { in: ids } },
      });
    });
  }

  const { limparCacheListaUploads, limparCacheCotaGoogleDrive } = await import(
    "@/lib/google-drive-uploads"
  );
  limparCacheListaUploads();
  limparCacheCotaGoogleDrive();
  return validos.length;
}

async function reconciliarTodasEmpresas() {
  const empresas = await executarSemRls((tx) =>
    tx.empresa.findMany({
      where: { status: "ativo" },
      select: { id: true, slug: true, nome: true },
    })
  );
  const { listarArquivosUploadsEmpresaGoogleDrive } = await import(
    "@/lib/google-drive-uploads"
  );
  for (const empresa of empresas) {
    try {
      await runWithTenantContext(empresa.id, () =>
        listarArquivosUploadsEmpresaGoogleDrive(empresa.slug, {
          force: true,
          nomeEmpresa: empresa.nome,
          empresaId: empresa.id,
        })
      );
    } catch (erro) {
      console.warn(
        `[gdrive-watch] reconciliação ${empresa.slug} falhou:`,
        erro instanceof Error ? erro.message : erro
      );
    }
  }
}

async function processarMudancasInterno() {
  const { googleDriveUploadsConfigurado } = await import(
    "@/lib/google-drive-uploads"
  );
  if (!googleDriveUploadsConfigurado()) return;

  const drive = await criarClienteGoogleDrive();
  if (!drive) return;

  let estado = await garantirPageToken(drive);
  let pageToken = estado.pageToken;
  const todas: MudancaDrive[] = [];

  try {
    let next: string | undefined = pageToken;
    do {
      const resposta = await drive.changes.list({
        pageToken: next,
        includeRemoved: true,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        spaces: "drive",
        fields:
          "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,trashed,explicitlyTrashed,mimeType))",
      });
      todas.push(...((resposta.data.changes || []) as MudancaDrive[]));
      next = resposta.data.nextPageToken || undefined;
      if (resposta.data.newStartPageToken) {
        pageToken = resposta.data.newStartPageToken;
      }
    } while (next);
  } catch (erro) {
    const status = Number(
      (erro as { code?: number; response?: { status?: number } })?.code ??
        (erro as { response?: { status?: number } })?.response?.status ??
        0
    );
    if (status === 410) {
      console.warn("[gdrive-watch] pageToken expirado — reconciliação completa.");
      const inicio = await drive.changes.getStartPageToken({
        supportsAllDrives: true,
      });
      const novo = inicio.data.startPageToken?.trim();
      if (novo) {
        gravarEstadoWatch({ ...estado, pageToken: novo });
      }
      await reconciliarTodasEmpresas();
      return;
    }
    throw erro;
  }

  const { fileIds, pastaRemovida } = analisarMudancasDrive(todas);
  if (fileIds.length > 0) {
    const limpos = await aplicarExclusoesNaOs(fileIds);
    if (limpos > 0) {
      console.log(`[gdrive-watch] ${limpos} anexo(s) removido(s) da OS após exclusão no Drive.`);
    }
  }
  if (pastaRemovida) {
    await reconciliarTodasEmpresas();
  }

  const atual = lerEstadoWatch() || estado;
  if (pageToken !== atual.pageToken) {
    gravarEstadoWatch({ ...atual, pageToken });
  }
}

export async function processarMudancasGoogleDrive() {
  if (globalWatch.__gdriveChangesLock) return globalWatch.__gdriveChangesLock;
  const tarefa = processarMudancasInterno()
    .catch((erro) => {
      console.warn(
        "[gdrive-watch] falha ao processar mudanças:",
        erro instanceof Error ? erro.message : erro
      );
    })
    .finally(() => {
      if (globalWatch.__gdriveChangesLock === tarefa) {
        globalWatch.__gdriveChangesLock = null;
      }
    });
  globalWatch.__gdriveChangesLock = tarefa;
  return tarefa;
}

export function statusWatchGoogleDrive() {
  const estado = lerEstadoWatch();
  return {
    webhook: "google-drive",
    url: urlWebhookGoogleDrive(),
    watchAtivo: Boolean(
      estado?.channelId &&
        estado.expirationMs &&
        estado.expirationMs > Date.now()
    ),
    expiraEm: estado?.expirationMs
      ? new Date(estado.expirationMs).toISOString()
      : null,
    consultaPeriodicaMs: intervaloConsultaMs(),
  };
}

export async function iniciarSincronizacaoMudancasGoogleDrive() {
  if (globalWatch.__gdriveWatchIniciado) return;
  const { googleDriveUploadsConfigurado } = await import(
    "@/lib/google-drive-uploads"
  );
  if (!googleDriveUploadsConfigurado()) return;
  globalWatch.__gdriveWatchIniciado = true;

  try {
    const drive = await exigirDrive();
    await registrarWatch(drive);
  } catch (erro) {
    console.warn(
      "[gdrive-watch] não registrou o aviso do Drive:",
      erro instanceof Error ? erro.message : erro
    );
  }

  if (!globalWatch.__gdriveChangesTimer) {
    globalWatch.__gdriveChangesTimer = setInterval(() => {
      void processarMudancasGoogleDrive();
    }, intervaloConsultaMs());
    globalWatch.__gdriveChangesTimer.unref?.();
  }

  if (!globalWatch.__gdriveWatchTimer) {
    globalWatch.__gdriveWatchTimer = setInterval(() => {
      void (async () => {
        try {
          const drive = await criarClienteGoogleDrive();
          if (drive) await registrarWatch(drive);
        } catch (erro) {
          console.warn(
            "[gdrive-watch] renovação do webhook falhou:",
            erro instanceof Error ? erro.message : erro
          );
        }
      })();
    }, INTERVALO_RENOVAR_WATCH_MS);
    globalWatch.__gdriveWatchTimer.unref?.();
  }

  console.log(
    `[gdrive-watch] consulta periódica a cada ${Math.round(intervaloConsultaMs() / 1000)}s`
  );
  void processarMudancasGoogleDrive();
}
