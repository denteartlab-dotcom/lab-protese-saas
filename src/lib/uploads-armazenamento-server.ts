import { exec } from "child_process";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
import type { ArquivoGaleriaItem } from "@/lib/galeria-uploads-types";
import {
  LIMITE_ARMAZENAMENTO_BYTES,
  LIMITE_GALERIA_GB,
} from "@/lib/uploads-armazenamento";
import type { PastaUpload } from "@/lib/upload-arquivo-server";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import {
  bytesTotalArquivosBanco,
  excluirArquivoBancoPorId,
  listarArquivosBanco,
} from "@/lib/upload-arquivo-server";
import { uploadUsaOneDrive } from "@/lib/upload-onedrive-storage";

const PASTAS_UPLOAD: PastaUpload[] = [
  "os",
  "despesas",
  "receitas",
  "produtos",
  "disparos-whatsapp",
];

export function normalizarSlugPastaUploads(empresaSlug: string): string {
  return empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function caminhoPastaUploads(empresaSlug?: string) {
  // Fora de public/ — não é servido como estático pelo Next.
  const base = path.join(process.cwd(), "var", "uploads");
  if (!empresaSlug?.trim()) return base;
  return path.join(base, normalizarSlugPastaUploads(empresaSlug));
}

/** Resolve caminho relativo dentro da pasta da empresa; rejeita path traversal. */
export function resolverArquivoUploadsSeguro(relativePath: string, empresaSlug?: string) {
  const base = path.resolve(caminhoPastaUploads(empresaSlug));
  const limpo = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const alvo = path.resolve(base, limpo);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) {
    throw new Error("Caminho inválido");
  }
  return alvo;
}

export async function garantirPastasUploadEmpresa(empresaSlug: string) {
  // Com OneDrive, pastas ficam só na nuvem — não cria var/uploads na VPS.
  if (uploadUsaOneDrive()) {
    return caminhoPastaUploads(empresaSlug);
  }
  const base = caminhoPastaUploads(empresaSlug);
  await Promise.all(
    PASTAS_UPLOAD.map((pasta) => mkdir(path.join(base, pasta), { recursive: true }))
  );
  return base;
}

function resolverArquivoUploads(relativePath: string, empresaSlug?: string) {
  return resolverArquivoUploadsSeguro(relativePath, empresaSlug);
}

export type ArquivoGaleria = ArquivoGaleriaItem;

export async function listarArquivosGaleria(
  empresaId?: string,
  empresaSlug?: string
): Promise<ArquivoGaleria[]> {
  const lista: ArquivoGaleria[] = [];
  const slugNorm = empresaSlug ? normalizarSlugPastaUploads(empresaSlug) : "";

  // Em modo OneDrive não varre disco local (não há arquivos na VPS).
  if (slugNorm && !uploadUsaOneDrive()) {
    const base = caminhoPastaUploads(slugNorm);
    await mkdir(base, { recursive: true });

    async function walk(dir: string, prefix: string) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, rel);
        } else if (entry.isFile()) {
          const info = await stat(full);
          const urlPath = [slugNorm, ...rel.split(path.sep)].join("/");
          lista.push({
            relativePath: rel.replace(/\\/g, "/"),
            nome: entry.name,
            bytes: info.size,
            url: `/api/uploads/disco/${urlPath}`,
            criadoEm: info.mtime.toISOString(),
          });
        }
      }
    }

    await walk(base, "");
  }

  const doBanco = await listarArquivosBanco(empresaId);
  return [...lista, ...doBanco].sort((a, b) => {
    const tb = new Date(b.criadoEm).getTime();
    const ta = new Date(a.criadoEm).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export async function excluirArquivoGaleria(
  relativePath: string,
  empresaId?: string,
  empresaSlug?: string
) {
  if (relativePath.startsWith("db/")) {
    await excluirArquivoBancoPorId(relativePath.slice(3), empresaId);
    return;
  }
  const alvo = resolverArquivoUploads(relativePath, empresaSlug);
  await unlink(alvo);
}

export async function abrirPastaUploadsNoSistema(empresaSlug?: string) {
  const pasta = empresaSlug
    ? await garantirPastasUploadEmpresa(empresaSlug)
    : caminhoPastaUploads();
  await mkdir(pasta, { recursive: true });
  const pastaWin = pasta.replace(/\//g, "\\");

  try {
    if (process.platform === "win32") {
      await execAsync(`explorer "${pastaWin}"`);
      return { aberto: true, pasta };
    }
    if (process.platform === "darwin") {
      await execAsync(`open "${pasta}"`);
      return { aberto: true, pasta };
    }
    if (process.platform === "linux") {
      await execAsync(`xdg-open "${pasta}"`);
      return { aberto: true, pasta };
    }
  } catch {
    /* sem interface gráfica ou permissão */
  }

  return {
    aberto: false,
    pasta,
    mensagem:
      "Não foi possível abrir o gerenciador de arquivos. Use a lista abaixo para excluir arquivos.",
  };
}

async function tamanhoDiretorio(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await tamanhoDiretorio(full);
      } else if (entry.isFile()) {
        const info = await stat(full);
        total += info.size;
      }
    }
  } catch {
    /* pasta inexistente */
  }
  return total;
}

export function resumoArmazenamentoVazio() {
  return {
    bytesUsados: 0,
    bytesLivres: LIMITE_ARMAZENAMENTO_BYTES,
    limiteBytes: LIMITE_ARMAZENAMENTO_BYTES,
    limiteGb: LIMITE_GALERIA_GB,
    percentualUsado: 0,
    percentualLivre: 100,
    storageMode: "disk" as const,
    onedriveAtivo: false,
  };
}

export async function calcularArmazenamentoGaleria(
  empresaId?: string,
  empresaSlug?: string,
  empresaNome?: string
) {
  const onedrive = uploadUsaOneDrive();

  // OneDrive: cota real da nuvem (Graph) — usado/livre sincronizado com a conta.
  if (onedrive) {
    try {
      const { obterCotaOneDriveGraph } = await import("@/lib/onedrive-graph");
      const cota = await obterCotaOneDriveGraph();
      if (cota && cota.total > 0) {
        const bytesUsados = cota.used;
        const bytesLivres = cota.remaining;
        const limiteBytes = cota.total;
        const percentualUsado = Math.min(
          100,
          Math.round((bytesUsados / limiteBytes) * 100)
        );
        const limiteGb =
          limiteBytes >= 1024 ** 3
            ? Math.round((limiteBytes / 1024 ** 3) * 10) / 10
            : Math.round((limiteBytes / 1024 ** 2) * 10) / 10 / 1024;
        return {
          bytesUsados,
          bytesLivres,
          limiteBytes,
          limiteGb: Math.max(limiteGb, 0.1),
          percentualUsado,
          percentualLivre: 100 - percentualUsado,
          storageMode: "onedrive" as const,
          onedriveAtivo: true,
        };
      }
    } catch (erro) {
      console.warn("[uploads] cota OneDrive indisponível, usando metadados locais:", erro);
    }
  }

  if (empresaSlug && !onedrive) {
    await garantirPastasUploadEmpresa(empresaSlug);
  }
  const bytesDisco =
    empresaSlug && !onedrive
      ? await tamanhoDiretorio(caminhoPastaUploads(empresaSlug))
      : 0;
  const bytesBanco = await bytesTotalArquivosBanco(empresaId);
  // OneDrive (fallback): metadados do banco. Disco: inclui pasta local de backup.
  const bytesBackup =
    !onedrive && empresaSlug && empresaSlug.trim()
      ? await tamanhoDiretorio(pastaBackupEmpresa(empresaSlug, empresaNome))
      : 0;
  const bytesUsados = bytesDisco + bytesBanco + bytesBackup;
  const bytesLivres = Math.max(0, LIMITE_ARMAZENAMENTO_BYTES - bytesUsados);
  const percentualUsado =
    LIMITE_ARMAZENAMENTO_BYTES > 0
      ? Math.min(100, Math.round((bytesUsados / LIMITE_ARMAZENAMENTO_BYTES) * 100))
      : 0;
  const percentualLivre = 100 - percentualUsado;

  return {
    bytesUsados,
    bytesLivres,
    limiteBytes: LIMITE_ARMAZENAMENTO_BYTES,
    limiteGb: LIMITE_GALERIA_GB,
    percentualUsado,
    percentualLivre,
    storageMode: onedrive
      ? ("onedrive" as const)
      : bytesDisco > 0 || !empresaId
        ? ("disk" as const)
        : ("database" as const),
    onedriveAtivo: onedrive,
  };
}
