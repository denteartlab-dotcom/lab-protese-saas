import { readdir, stat } from "fs/promises";
import path from "path";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";
import unzipper from "unzipper";
import type { BackupLaboratorioPayload } from "@/lib/backup-laboratorio";
import { nomeArquivoUploadBackupSeguro } from "@/lib/backup-uploads-espelho";
import { prisma } from "@/lib/db";
import { uploadUsaBancoDados, uploadUsaOneDrive } from "@/lib/upload-arquivo-server";
import { baixarArquivoOneDrive } from "@/lib/upload-onedrive-storage";
import { caminhoPastaUploads } from "@/lib/uploads-armazenamento-server";

export const BACKUP_JSON_NO_ZIP = "backup.json";
export const UPLOADS_ZIP_PREFIX = "uploads/";

export type EntradaUploadZip = {
  zipPath: string;
  dados: Buffer;
};

/** JSON do zip sem bytes em base64 (ficam na pasta uploads/). */
export function backupJsonSemBytesUpload(backup: BackupLaboratorioPayload): BackupLaboratorioPayload {
  const linhas = backup.data.ArquivoUpload;
  if (!Array.isArray(linhas)) return backup;

  return {
    ...backup,
    data: {
      ...backup.data,
      ArquivoUpload: linhas.map((linha) => {
        if (!linha || typeof linha !== "object") return linha;
        const { dados: _dados, ...resto } = linha as Record<string, unknown>;
        return resto;
      }),
    },
  };
}

async function walkUploadsDisco(
  dir: string,
  prefixo: string,
  destino: EntradaUploadZip[]
) {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entrada of entradas) {
    const rel = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      await walkUploadsDisco(completo, rel, destino);
    } else if (entrada.isFile()) {
      const info = await stat(completo);
      if (info.size <= 0) continue;
      const { readFile } = await import("fs/promises");
      destino.push({
        zipPath: `${UPLOADS_ZIP_PREFIX}${rel.replace(/\\/g, "/")}`,
        dados: await readFile(completo),
      });
    }
  }
}

async function baixarOneDriveComTimeout(
  remotePath: string,
  timeoutMs = 45_000
): Promise<Buffer | null> {
  try {
    return await Promise.race([
      baixarArquivoOneDrive(remotePath),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.warn("[backup-zip] OneDrive skip", remotePath, err);
    return null;
  }
}

export async function coletarUploadsParaZipBackup(
  empresaId: string,
  empresaSlug: string
): Promise<EntradaUploadZip[]> {
  const entradas: EntradaUploadZip[] = [];
  const caminhos = new Set<string>();

  const adicionar = (zipPath: string, dados: Buffer) => {
    const chave = zipPath.replace(/\\/g, "/");
    if (!dados.length || caminhos.has(chave)) return;
    caminhos.add(chave);
    entradas.push({ zipPath: chave, dados });
  };

  if (uploadUsaBancoDados() || uploadUsaOneDrive()) {
    const rows = await prisma.arquivoUpload.findMany({
      where: { empresaId },
      select: {
        id: true,
        pasta: true,
        nome: true,
        dados: true,
        remotePath: true,
      },
      orderBy: { criadoEm: "asc" },
    });

    for (const row of rows) {
      let bytes: Buffer | null =
        row.dados && row.dados.length > 0 ? Buffer.from(row.dados) : null;

      if (!bytes && row.remotePath) {
        bytes = await baixarOneDriveComTimeout(row.remotePath);
      }

      if (!bytes?.length) continue;
      adicionar(
        `${UPLOADS_ZIP_PREFIX}${row.pasta}/${row.id}-${nomeArquivoUploadBackupSeguro(row.nome)}`,
        bytes
      );
    }
  }

  // Disco local (legado / UPLOAD_STORAGE=disk / espelho) — complementa o ZIP.
  const origem = caminhoPastaUploads(empresaSlug);
  try {
    const info = await stat(origem);
    if (info.isDirectory()) {
      const doDisco: EntradaUploadZip[] = [];
      await walkUploadsDisco(origem, "", doDisco);
      for (const item of doDisco) adicionar(item.zipPath, item.dados);
    }
  } catch {
    /* sem pasta */
  }

  return entradas;
}

export async function criarZipBackupEmpresa(
  backup: BackupLaboratorioPayload,
  uploads: EntradaUploadZip[]
): Promise<Buffer> {
  const json = JSON.stringify(backupJsonSemBytesUpload(backup), null, 2);

  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
    archive.pipe(stream);

    archive.append(json, { name: BACKUP_JSON_NO_ZIP });
    for (const item of uploads) {
      archive.append(item.dados, { name: item.zipPath.replace(/\\/g, "/") });
    }

    void archive.finalize();
  });
}

export type ConteudoZipBackup = {
  backupJson: string;
  uploads: Map<string, Buffer>;
};

export async function extrairConteudoZipBackup(buffer: Buffer): Promise<ConteudoZipBackup> {
  const directory = await unzipper.Open.buffer(buffer);
  let backupJson: string | null = null;
  const uploads = new Map<string, Buffer>();

  for (const file of directory.files) {
    if (file.type === "Directory") continue;
    const caminho = file.path.replace(/\\/g, "/");
    const nome = caminho.split("/").pop() || caminho;

    if (caminho === BACKUP_JSON_NO_ZIP || nome === BACKUP_JSON_NO_ZIP) {
      backupJson = (await file.buffer()).toString("utf8");
      continue;
    }

    if (caminho.startsWith(UPLOADS_ZIP_PREFIX)) {
      uploads.set(caminho, await file.buffer());
      continue;
    }

    if (!backupJson && nome.endsWith(".json")) {
      backupJson = (await file.buffer()).toString("utf8");
    }
  }

  if (!backupJson) {
    throw new Error("ZIP_SEM_BACKUP_JSON");
  }

  return { backupJson, uploads };
}

export function caminhoZipUploadParaId(caminhoZip: string): string | null {
  const base = path.basename(caminhoZip.replace(/\\/g, "/"));
  const match = base.match(/^([a-z0-9]+)-/i);
  return match?.[1] ?? null;
}

export function resolverDadosUploadImport(
  row: Record<string, unknown>,
  uploads: Map<string, Buffer>
): Buffer {
  const id = String(row.id || "");
  const pasta = String(row.pasta || "os");
  const nome = String(row.nome || "");
  const safe = nomeArquivoUploadBackupSeguro(nome);
  const candidatos = [
    `${UPLOADS_ZIP_PREFIX}${pasta}/${id}-${safe}`,
    `${UPLOADS_ZIP_PREFIX}${pasta}/${id}-${nome}`,
  ];

  for (const chave of candidatos) {
    const buf = uploads.get(chave);
    if (buf?.length) return buf;
  }

  for (const [chave, buf] of uploads) {
    if (!chave.startsWith(`${UPLOADS_ZIP_PREFIX}${pasta}/`)) continue;
    if (chave.includes(`/${id}-`) || chave.endsWith(`/${id}`)) {
      if (buf.length) return buf;
    }
  }

  const dadosB64 = row.dados;
  if (typeof dadosB64 === "string" && dadosB64.length > 0) {
    return Buffer.from(dadosB64, "base64");
  }

  return Buffer.alloc(0);
}
