import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import {
  garantirPastasUploadEmpresa,
  normalizarSlugPastaUploads,
  caminhoPastaUploads,
  resolverArquivoUploadsSeguro,
} from "@/lib/uploads-armazenamento-server";

export type PastaUpload = "os" | "despesas" | "receitas" | "disparos-whatsapp" | "produtos";

export type ArquivoEnviado = {
  name: string;
  type: string;
  url: string;
};

const MAX_BYTES_ARQUIVO = 4 * 1024 * 1024;

export function pastaUploadValida(pasta: string | null): PastaUpload {
  if (pasta === "despesas") return "despesas";
  if (pasta === "receitas") return "receitas";
  if (pasta === "disparos-whatsapp") return "disparos-whatsapp";
  if (pasta === "produtos") return "produtos";
  return "os";
}

/** Na Vercel o disco é somente leitura; anexos vão para o PostgreSQL. */
export function uploadUsaBancoDados() {
  return process.env.VERCEL === "1" || process.env.UPLOAD_STORAGE === "database";
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-");
}

function mimeDeArquivo(file: File) {
  if (file.type?.trim()) return file.type;
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".pdf")) return "application/pdf";
  if (/\.(jpe?g)$/.test(nome)) return "image/jpeg";
  if (nome.endsWith(".png")) return "image/png";
  if (nome.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/** URL autenticada para arquivo em disco (fora de public/). */
export function urlUploadDisco(slug: string, pasta: PastaUpload, filename: string) {
  const s = normalizarSlugPastaUploads(slug);
  return `/api/uploads/disco/${s}/${pasta}/${filename}`;
}

/**
 * Converte URLs legadas `/uploads/...` para a rota autenticada.
 * Mantém `/api/uploads/...` e URLs absolutas intactas.
 */
export function normalizarUrlUploadParaApi(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith("/api/uploads/")) return u;
  if (u.startsWith("/uploads/")) {
    return `/api/uploads/disco/${u.slice("/uploads/".length)}`;
  }
  try {
    const parsed = new URL(u, "https://local.invalid");
    if (parsed.pathname.startsWith("/uploads/")) {
      return `/api/uploads/disco/${parsed.pathname.slice("/uploads/".length)}`;
    }
  } catch {
    /* ignore */
  }
  return u;
}

export async function salvarArquivosUpload(
  pasta: PastaUpload,
  files: File[],
  empresaId?: string,
  empresaSlug?: string,
  opcoes?: { forcarBanco?: boolean }
): Promise<ArquivoEnviado[]> {
  if (!files.length) return [];

  for (const file of files) {
    if (file.size > MAX_BYTES_ARQUIVO) {
      throw new Error(
        `O arquivo "${file.name}" excede o limite de 4 MB. Reduza o tamanho ou envie outro arquivo.`
      );
    }
  }

  if (opcoes?.forcarBanco || uploadUsaBancoDados()) {
    if (!empresaId) {
      throw new Error("empresaId obrigatório para upload no banco.");
    }
    const uploaded: ArquivoEnviado[] = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const mimeType = mimeDeArquivo(file);
      const registro = await prisma.arquivoUpload.create({
        data: {
          empresaId,
          pasta,
          nome: file.name,
          mimeType,
          tamanho: bytes.length,
          dados: bytes,
        },
      });
      uploaded.push({
        name: file.name,
        type: mimeType,
        url: `/api/uploads/arquivo/${registro.id}`,
      });
    }
    return uploaded;
  }

  if (!empresaSlug?.trim()) {
    throw new Error("empresaSlug obrigatório para upload em disco.");
  }

  const slug = normalizarSlugPastaUploads(empresaSlug);
  await garantirPastasUploadEmpresa(slug);
  const uploadDir = path.join(caminhoPastaUploads(slug), pasta);

  return Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(file.name)}`;
      await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
      const mimeType = mimeDeArquivo(file);
      return {
        name: file.name,
        type: mimeType,
        url: urlUploadDisco(slug, pasta, filename),
      };
    })
  );
}

export async function lerArquivoUploadPorId(id: string) {
  return prisma.arquivoUpload.findUnique({ where: { id } });
}

export async function lerArquivoDiscoPorCaminhoRelativo(
  empresaSlug: string,
  relativePath: string
): Promise<{ bytes: Buffer; mimeType: string; nome: string } | null> {
  const alvo = resolverArquivoUploadsSeguro(relativePath, empresaSlug);
  try {
    await access(alvo);
  } catch {
    return null;
  }
  const bytes = await readFile(alvo);
  const nome = path.basename(alvo);
  const lower = nome.toLowerCase();
  let mimeType = "application/octet-stream";
  if (lower.endsWith(".pdf")) mimeType = "application/pdf";
  else if (/\.jpe?g$/.test(lower)) mimeType = "image/jpeg";
  else if (lower.endsWith(".png")) mimeType = "image/png";
  else if (lower.endsWith(".webp")) mimeType = "image/webp";
  else if (lower.endsWith(".gif")) mimeType = "image/gif";
  return { bytes, mimeType, nome };
}

export async function bytesTotalArquivosBanco(empresaId?: string) {
  const agg = await prisma.arquivoUpload.aggregate({
    where: empresaId ? { empresaId } : undefined,
    _sum: { tamanho: true },
  });
  return agg._sum.tamanho ?? 0;
}

export async function listarArquivosBanco(empresaId?: string) {
  const rows = await prisma.arquivoUpload.findMany({
    where: empresaId ? { empresaId } : undefined,
    select: { id: true, pasta: true, nome: true, tamanho: true, criadoEm: true },
    orderBy: { criadoEm: "desc" },
  });
  return rows.map((row) => ({
    relativePath: `db/${row.id}`,
    nome: row.nome,
    bytes: row.tamanho,
    url: `/api/uploads/arquivo/${row.id}`,
    criadoEm: row.criadoEm.toISOString(),
  }));
}

export async function excluirArquivoBancoPorId(id: string, empresaId?: string) {
  if (empresaId) {
    await prisma.arquivoUpload.deleteMany({ where: { id, empresaId } });
    return;
  }
  await prisma.arquivoUpload.delete({ where: { id } });
}
