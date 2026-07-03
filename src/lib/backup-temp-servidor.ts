import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), ".tmp", "backup-jobs");
const TTL_MS = 2 * 60 * 60 * 1000;

type MetaArquivo = {
  empresaId: string;
  nomeArquivo: string;
  criadoEm: number;
};

function dirEmpresa(empresaId: string) {
  return path.join(BASE_DIR, empresaId);
}

function caminhoZip(empresaId: string, jobId: string) {
  return path.join(dirEmpresa(empresaId), `${jobId}.zip`);
}

function caminhoMeta(empresaId: string, jobId: string) {
  return path.join(dirEmpresa(empresaId), `${jobId}.meta.json`);
}

function caminhoStaging(empresaId: string, stagingId: string, ext: "zip" | "json") {
  return path.join(dirEmpresa(empresaId), `staging-${stagingId}.${ext}`);
}

export async function salvarBackupZipTemp(
  empresaId: string,
  jobId: string,
  zip: Buffer,
  nomeArquivo: string
) {
  await mkdir(dirEmpresa(empresaId), { recursive: true });
  await writeFile(caminhoZip(empresaId, jobId), zip);
  const meta: MetaArquivo = { empresaId, nomeArquivo, criadoEm: Date.now() };
  await writeFile(caminhoMeta(empresaId, jobId), JSON.stringify(meta), "utf8");
}

export async function lerBackupZipTemp(empresaId: string, jobId: string) {
  const metaRaw = await readFile(caminhoMeta(empresaId, jobId), "utf8").catch(() => null);
  if (!metaRaw) return null;
  const meta = JSON.parse(metaRaw) as MetaArquivo;
  if (Date.now() - meta.criadoEm > TTL_MS) {
    await removerBackupZipTemp(empresaId, jobId).catch(() => undefined);
    return null;
  }
  const zip = await readFile(caminhoZip(empresaId, jobId));
  return { zip, nomeArquivo: meta.nomeArquivo };
}

export async function removerBackupZipTemp(empresaId: string, jobId: string) {
  await unlink(caminhoZip(empresaId, jobId)).catch(() => undefined);
  await unlink(caminhoMeta(empresaId, jobId)).catch(() => undefined);
}

export async function salvarStagingImportBackup(
  empresaId: string,
  stagingId: string,
  buffer: Buffer,
  ext: "zip" | "json"
) {
  await mkdir(dirEmpresa(empresaId), { recursive: true });
  const destino = caminhoStaging(empresaId, stagingId, ext);
  await writeFile(destino, buffer);
  return destino;
}

export async function lerStagingImportBackup(empresaId: string, stagingId: string) {
  const zipPath = caminhoStaging(empresaId, stagingId, "zip");
  const jsonPath = caminhoStaging(empresaId, stagingId, "json");
  try {
    const buffer = await readFile(zipPath);
    return { buffer, ext: "zip" as const, caminho: zipPath };
  } catch {
    try {
      const buffer = await readFile(jsonPath);
      return { buffer, ext: "json" as const, caminho: jsonPath };
    } catch {
      return null;
    }
  }
}

export async function removerStagingImportBackup(empresaId: string, stagingId: string) {
  await unlink(caminhoStaging(empresaId, stagingId, "zip")).catch(() => undefined);
  await unlink(caminhoStaging(empresaId, stagingId, "json")).catch(() => undefined);
}
