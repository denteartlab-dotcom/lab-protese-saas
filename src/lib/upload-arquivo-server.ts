import { writeFile, readFile, access } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import {
  garantirPastasUploadEmpresa,
  normalizarSlugPastaUploads,
  caminhoPastaUploads,
  resolverArquivoUploadsSeguro,
} from "@/lib/uploads-armazenamento-server";
import {
  baixarArquivoOneDrive,
  caminhoRemotoUpload,
  enviarBufferParaOneDrive,
  excluirArquivoOneDrive,
  uploadUsaOneDrive,
} from "@/lib/upload-onedrive-storage";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";

export { uploadUsaOneDrive } from "@/lib/upload-onedrive-storage";

export type PastaUpload = "os" | "despesas" | "receitas" | "disparos-whatsapp" | "produtos";

export type ArquivoEnviado = {
  name: string;
  type: string;
  url: string;
};

const MAX_BYTES_ARQUIVO = 4 * 1024 * 1024;

const MIME_BASE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MIME_WHATSAPP = new Set([
  ...MIME_BASE,
  "image/gif",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "video/mp4",
  "video/webm",
]);

const MIME_BLOQUEADOS = new Set([
  "image/svg+xml",
  "text/html",
  "text/xml",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
]);

export function pastaUploadValida(pasta: string | null): PastaUpload {
  if (pasta === "despesas") return "despesas";
  if (pasta === "receitas") return "receitas";
  if (pasta === "disparos-whatsapp") return "disparos-whatsapp";
  if (pasta === "produtos") return "produtos";
  return "os";
}

export function faltamCredenciaisOneDriveGraph(): string[] {
  carregarEnvArquivoRuntime();
  const faltando: string[] = [];
  if (!envRuntime("ONEDRIVE_GRAPH_CLIENT_ID")) faltando.push("ONEDRIVE_GRAPH_CLIENT_ID");
  if (!envRuntime("ONEDRIVE_GRAPH_CLIENT_SECRET")) faltando.push("ONEDRIVE_GRAPH_CLIENT_SECRET");
  if (!envRuntime("ONEDRIVE_GRAPH_REFRESH_TOKEN")) faltando.push("ONEDRIVE_GRAPH_REFRESH_TOKEN");
  return faltando;
}

/** Na Vercel o disco é somente leitura; anexos vão para o PostgreSQL. */
export function uploadUsaBancoDados() {
  carregarEnvArquivoRuntime();
  if (uploadUsaOneDrive()) return false;
  return envRuntime("VERCEL") === "1" || envRuntime("UPLOAD_STORAGE").toLowerCase() === "database";
}

export type ModoUploadStorage = "onedrive" | "database" | "disk";

export function modoUploadStorage(): ModoUploadStorage {
  if (uploadUsaOneDrive()) return "onedrive";
  if (uploadUsaBancoDados()) return "database";
  return "disk";
}

function exigirOneDriveSeConfiguradoNoEnv() {
  carregarEnvArquivoRuntime();
  const modo = envRuntime("UPLOAD_STORAGE").toLowerCase();
  const querOneDrive = modo === "onedrive" || modo === "";
  if (!querOneDrive && modo !== "") return;
  if (uploadUsaOneDrive()) return;

  const faltando = faltamCredenciaisOneDriveGraph();
  if (modo === "onedrive" || faltando.length < 3) {
    // Pediu onedrive, ou tem credenciais parciais — não cair no disco em silêncio.
    throw new Error(
      faltando.length
        ? `OneDrive não configurado. Falta no .env: ${faltando.join(", ")}. Rode: bash scripts/corrigir-env-onedrive-vps.sh`
        : "OneDrive Graph configurado, mas UPLOAD_STORAGE=disk impede o envio. Remova disk do .env."
    );
  }
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-");
}

function allowlistParaPasta(pasta: PastaUpload): Set<string> {
  return pasta === "disparos-whatsapp" ? MIME_WHATSAPP : MIME_BASE;
}

/** Detecta MIME pelos magic bytes (ignora declaração do cliente). */
export function detectarMimePorMagic(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf";
  }
  if (
    bytes.length >= 6 &&
    (bytes.toString("ascii", 0, 6) === "GIF87a" || bytes.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    return "video/mp4";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)) {
    return "audio/mpeg";
  }
  if (bytes.length >= 3 && bytes.toString("ascii", 0, 3) === "ID3") {
    return "audio/mpeg";
  }
  if (bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }
  return null;
}

function mimePorExtensao(nome: string): string | null {
  const lower = nome.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4a")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  return null;
}

export function validarMimeUpload(
  pasta: PastaUpload,
  bytes: Buffer,
  file: File
): string {
  const magic = detectarMimePorMagic(bytes);
  const declarado = file.type?.trim().toLowerCase() || "";
  const porExt = mimePorExtensao(file.name);

  const mime = magic || (declarado && !MIME_BLOQUEADOS.has(declarado) ? declarado : null) || porExt;
  if (!mime || MIME_BLOQUEADOS.has(mime)) {
    throw new Error(
      `O arquivo "${file.name}" tem tipo não permitido (SVG/HTML/scripts bloqueados).`
    );
  }

  const allow = allowlistParaPasta(pasta);
  if (!allow.has(mime)) {
    throw new Error(
      `O arquivo "${file.name}" não é permitido nesta pasta. Use PDF ou imagens JPEG/PNG/WebP${
        pasta === "disparos-whatsapp" ? " (ou mídia WhatsApp permitida)" : ""
      }.`
    );
  }

  if (magic && declarado && declarado !== magic && !MIME_BLOQUEADOS.has(declarado)) {
    // Cliente mentiu o Content-Type: confiar no magic.
  }

  return mime;
}

/** Imagens seguras inline; demais como attachment (mitiga XSS stored). */
export function contentDispositionUpload(mimeType: string, nome: string): string {
  const safe = encodeURIComponent(nome || "arquivo");
  const inline =
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp" ||
    mimeType === "image/gif";
  return `${inline ? "inline" : "attachment"}; filename="${safe}"`;
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

  carregarEnvArquivoRuntime();
  exigirOneDriveSeConfiguradoNoEnv();

  // OneDrive primeiro: todos os uploads do sistema vão direto para a nuvem (sem disco na VPS).
  if (uploadUsaOneDrive()) {
    if (!empresaId) {
      throw new Error("empresaId obrigatório para upload no OneDrive.");
    }
    if (!empresaSlug?.trim()) {
      throw new Error("empresaSlug obrigatório para upload no OneDrive.");
    }
    const empresaIdUpload = empresaId;
    const { garantirPastaModuloUploadOneDrive } = await import("@/lib/onedrive-graph");
    const slug = normalizarSlugPastaUploads(empresaSlug);
    // Só a pasta do módulo (ex.: uploads/os) — sem .keep nos outros módulos.
    await garantirPastaModuloUploadOneDrive(slug, pasta);

    const preparados = await Promise.all(
      files.map(async (file, index) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        const mimeType = validarMimeUpload(pasta, bytes, file);
        const filename = `${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2)}-${safeName(file.name)}`;
        return {
          file,
          bytes,
          mimeType,
          filename,
          remotePath: caminhoRemotoUpload(slug, pasta, filename),
        };
      })
    );

    // Mais paralelismo no Graph; Prisma fica numa 2ª fase para não segurar o slot.
    const CONCURRENCY = Math.min(8, preparados.length);
    let cursor = 0;

    async function workerUpload() {
      while (true) {
        const index = cursor++;
        if (index >= preparados.length) return;
        const item = preparados[index];
        await enviarBufferParaOneDrive(
          item.remotePath,
          item.bytes,
          item.filename,
          item.mimeType,
          { garantirPastas: false, atualizarCota: false }
        );
        console.info(`[uploads] OneDrive gravou: ${item.remotePath}`);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => workerUpload()));

    const totalBytes = preparados.reduce((s, p) => s + p.bytes.length, 0);
    const { ajustarCotaOneDriveAposUpload } = await import("@/lib/onedrive-graph");
    ajustarCotaOneDriveAposUpload(totalBytes);

    const uploaded = await Promise.all(
      preparados.map(async (item) => {
        const registro = await prisma.arquivoUpload.create({
          data: {
            empresaId: empresaIdUpload,
            pasta,
            nome: item.file.name,
            mimeType: item.mimeType,
            tamanho: item.bytes.length,
            dados: null,
            storage: "onedrive",
            remotePath: item.remotePath,
          },
        });
        return {
          name: item.file.name,
          type: item.mimeType,
          url: `/api/uploads/arquivo/${registro.id}`,
        } satisfies ArquivoEnviado;
      })
    );
    return uploaded;
  }

  if (opcoes?.forcarBanco || uploadUsaBancoDados()) {
    if (!empresaId) {
      throw new Error("empresaId obrigatório para upload no banco.");
    }
    const uploaded: ArquivoEnviado[] = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const mimeType = validarMimeUpload(pasta, bytes, file);
      const registro = await prisma.arquivoUpload.create({
        data: {
          empresaId,
          pasta,
          nome: file.name,
          mimeType,
          tamanho: bytes.length,
          dados: bytes,
          storage: "database",
          remotePath: null,
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

  const uploaded: ArquivoEnviado[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = validarMimeUpload(pasta, bytes, file);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(file.name)}`;
    await writeFile(path.join(uploadDir, filename), bytes);
    uploaded.push({
      name: file.name,
      type: mimeType,
      url: urlUploadDisco(slug, pasta, filename),
    });
  }
  return uploaded;
}

export async function lerArquivoUploadPorId(id: string) {
  return prisma.arquivoUpload.findUnique({ where: { id } });
}

/** Lê bytes do registro (banco ou OneDrive). */
export async function obterConteudoArquivoUpload(id: string): Promise<{
  empresaId: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  bytes: Buffer;
} | null> {
  const arquivo = await prisma.arquivoUpload.findUnique({ where: { id } });
  if (!arquivo) return null;

  if (arquivo.storage === "onedrive" && arquivo.remotePath) {
    const bytes = await baixarArquivoOneDrive(arquivo.remotePath);
    return {
      empresaId: arquivo.empresaId,
      nome: arquivo.nome,
      mimeType: arquivo.mimeType,
      tamanho: bytes.length || arquivo.tamanho,
      bytes,
    };
  }

  const dadosDb = arquivo.dados;
  if (!dadosDb || dadosDb.length === 0) return null;
  const bytes = Buffer.from(dadosDb);
  return {
    empresaId: arquivo.empresaId,
    nome: arquivo.nome,
    mimeType: arquivo.mimeType,
    tamanho: arquivo.tamanho,
    bytes,
  };
}

export async function lerArquivoDiscoPorCaminhoRelativo(
  empresaSlug: string,
  relativePath: string
): Promise<{ bytes: Buffer; mimeType: string; nome: string } | null> {
  const alvo = resolverArquivoUploadsSeguro(relativePath, empresaSlug);
  try {
    await access(alvo);
  } catch {
    // URLs antigas /api/uploads/disco/... → OneDrive (estrutura nova ou legada).
    const slug = normalizarSlugPastaUploads(empresaSlug);
    const rel = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
    const candidatos = [
      caminhoRemotoUpload(slug, rel.split("/")[0] || "os", rel.split("/").slice(1).join("/")),
      `${slug}/${rel}`,
    ].filter((p) => p && !p.endsWith("/"));

    try {
      const porMeta = await prisma.arquivoUpload.findFirst({
        where: {
          storage: "onedrive",
          OR: [
            ...candidatos.map((remotePath) => ({ remotePath })),
            { remotePath: { endsWith: `/${rel}` } },
          ],
        },
        select: { id: true },
      });
      if (porMeta) {
        const conteudo = await obterConteudoArquivoUpload(porMeta.id);
        if (conteudo) {
          return {
            bytes: conteudo.bytes,
            mimeType: conteudo.mimeType,
            nome: conteudo.nome,
          };
        }
      }
      for (const remotePath of candidatos) {
        try {
          const bytes = await baixarArquivoOneDrive(remotePath);
          const nome = path.basename(relativePath);
          const magic = detectarMimePorMagic(bytes);
          const mimeType = magic || mimePorExtensao(nome) || "application/octet-stream";
          return { bytes, mimeType, nome };
        } catch {
          /* tenta próximo */
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  const bytes = await readFile(alvo);
  const nome = path.basename(alvo);
  const magic = detectarMimePorMagic(bytes);
  const mimeType = magic || mimePorExtensao(nome) || "application/octet-stream";
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
  const row = await prisma.arquivoUpload.findFirst({
    where: empresaId ? { id, empresaId } : { id },
    select: { id: true, storage: true, remotePath: true, tamanho: true },
  });
  if (!row) return;

  if (row.storage === "onedrive" && row.remotePath) {
    await excluirArquivoOneDrive(row.remotePath, row.tamanho || 0);
  }

  if (empresaId) {
    await prisma.arquivoUpload.deleteMany({ where: { id, empresaId } });
    return;
  }
  await prisma.arquivoUpload.delete({ where: { id } });
}
