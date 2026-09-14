import { writeFile, readFile, access, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import {
  garantirPastasUploadEmpresa,
  normalizarSlugPastaUploads,
  caminhoPastaUploads,
  resolverArquivoUploadsSeguro,
} from "@/lib/uploads-armazenamento-server";
import {
  baixarArquivoGoogleDrive,
  caminhoRemotoUpload,
  enviarBufferParaGoogleDrive,
  excluirArquivoGoogleDrive,
  uploadUsaGoogleDrive,
  uploadUsaOneDrive,
} from "@/lib/upload-google-drive-storage";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";
import { googleDriveUploadsConfigurado } from "@/lib/google-drive-uploads";
import { extrairFileIdGdrive } from "@/lib/google-drive-shared";

export { uploadUsaGoogleDrive, uploadUsaOneDrive } from "@/lib/upload-google-drive-storage";

export type PastaUpload = "os" | "despesas" | "receitas" | "disparos-whatsapp" | "produtos";

export type ArquivoEnviado = {
  name: string;
  type: string;
  url: string;
};

const MAX_BYTES_ARQUIVO = 4 * 1024 * 1024;
/** Anexos de OS / pedido de envio: alinhado ao nginx (310M). */
const MAX_BYTES_ARQUIVO_GRANDE = 310 * 1024 * 1024;

const MIME_BASE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Extensões aceitas na seção Arquivos do pedido de envio (inclui 3D). */
const EXTENSOES_ARQUIVO_SOLICITACAO = [
  ".pdf",
  ".stl",
  ".obj",
  ".ply",
  ".3mf",
  ".glb",
  ".gltf",
  ".zip",
  ".rar",
  ".7z",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".dcm",
  ".dxf",
  ".step",
  ".stp",
  ".iges",
  ".igs",
];

const MIME_ARQUIVO_SOLICITACAO = new Set([
  "application/pdf",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "model/stl",
  "model/obj",
  "model/3mf",
  "model/mesh",
  "model/gltf+json",
  "model/gltf-binary",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "application/wavefront-obj",
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

export function faltamCredenciaisGoogleDrive(): string[] {
  carregarEnvArquivoRuntime();
  const faltando: string[] = [];
  if (
    !envRuntime("GOOGLE_DRIVE_FOLDER_ID") &&
    !process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  ) {
    faltando.push("GOOGLE_DRIVE_FOLDER_ID");
  }
  const temCred =
    Boolean(envRuntime("GOOGLE_APPLICATION_CREDENTIALS")) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) ||
    Boolean(envRuntime("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON")) ||
    Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim());
  if (!temCred) {
    faltando.push("GOOGLE_APPLICATION_CREDENTIALS");
  }
  return faltando;
}

/** @deprecated use faltamCredenciaisGoogleDrive */
export function faltamCredenciaisOneDriveGraph(): string[] {
  return faltamCredenciaisGoogleDrive();
}

/** Na Vercel o disco é somente leitura; anexos vão para o PostgreSQL. */
export function uploadUsaBancoDados() {
  carregarEnvArquivoRuntime();
  if (uploadUsaGoogleDrive()) return false;
  return envRuntime("VERCEL") === "1" || envRuntime("UPLOAD_STORAGE").toLowerCase() === "database";
}

export type ModoUploadStorage = "gdrive" | "onedrive" | "database" | "disk";

export function modoUploadStorage(): ModoUploadStorage {
  if (uploadUsaGoogleDrive()) return "gdrive";
  if (uploadUsaBancoDados()) return "database";
  return "disk";
}

function exigirGoogleDriveSeConfiguradoNoEnv() {
  carregarEnvArquivoRuntime();
  const modo = envRuntime("UPLOAD_STORAGE").toLowerCase();
  const querNuvem =
    modo === "gdrive" ||
    modo === "onedrive" ||
    modo === "";
  if (!querNuvem && modo !== "") return;
  if (uploadUsaGoogleDrive()) return;

  const faltando = faltamCredenciaisGoogleDrive();
  if (modo === "gdrive" || modo === "onedrive" || faltando.length < 2) {
    throw new Error(
      faltando.length
        ? `Google Drive não configurado. Falta no .env: ${faltando.join(", ")}. Veja deploy/GOOGLE-DRIVE-UPLOADS.md`
        : "Google Drive configurado, mas UPLOAD_STORAGE=disk impede o envio. Remova disk do .env."
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
  if (pasta === "disparos-whatsapp") return MIME_WHATSAPP;
  // OS: imagens/PDF + STL/OBJ e demais arquivos do laboratório
  if (pasta === "os") {
    return new Set([...MIME_BASE, ...MIME_ARQUIVO_SOLICITACAO]);
  }
  return MIME_BASE;
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
  if (lower.endsWith(".stl")) return "model/stl";
  if (lower.endsWith(".obj")) return "model/obj";
  if (lower.endsWith(".ply")) return "model/mesh";
  if (lower.endsWith(".3mf")) return "model/3mf";
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".rar")) return "application/vnd.rar";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".dcm")) return "application/dicom";
  if (lower.endsWith(".dxf")) return "image/vnd.dxf";
  if (lower.endsWith(".step") || lower.endsWith(".stp")) return "application/step";
  if (lower.endsWith(".iges") || lower.endsWith(".igs")) return "model/iges";
  return null;
}

function extensaoArquivoPermitidaSolicitacao(nome: string) {
  const lower = nome.toLowerCase();
  return EXTENSOES_ARQUIVO_SOLICITACAO.some((ext) => lower.endsWith(ext));
}

export function validarMimeUpload(
  pasta: PastaUpload,
  bytes: Buffer,
  file: File,
  opcoes?: { modoMime?: "padrao" | "arquivos-solicitacao" | "imagens-solicitacao" }
): string {
  const magic = detectarMimePorMagic(bytes);
  const declarado = file.type?.trim().toLowerCase() || "";
  const porExt = mimePorExtensao(file.name);
  const modo = opcoes?.modoMime || "padrao";

  if (modo === "imagens-solicitacao") {
    const mimeImg =
      magic ||
      (declarado.startsWith("image/") ? declarado : null) ||
      (porExt?.startsWith("image/") ? porExt : null);
    if (!mimeImg || !["image/jpeg", "image/png", "image/webp"].includes(mimeImg)) {
      throw new Error(
        `O arquivo "${file.name}" não é uma imagem permitida. Use JPEG, PNG ou WebP.`
      );
    }
    return mimeImg;
  }

  if (modo === "arquivos-solicitacao") {
    if (magic?.startsWith("image/")) {
      throw new Error(
        `O arquivo "${file.name}" é uma imagem. Envie imagens na seção de imagens.`
      );
    }
    const mime =
      magic ||
      (declarado && !MIME_BLOQUEADOS.has(declarado) && !declarado.startsWith("image/")
        ? declarado
        : null) ||
      porExt ||
      (extensaoArquivoPermitidaSolicitacao(file.name) ? "application/octet-stream" : null);

    if (!mime || MIME_BLOQUEADOS.has(mime) || mime.startsWith("image/")) {
      throw new Error(
        `O arquivo "${file.name}" tem tipo não permitido (SVG/HTML/scripts ou imagem).`
      );
    }

    const permitido =
      !mime.startsWith("image/") &&
      !MIME_BLOQUEADOS.has(mime) &&
      (MIME_ARQUIVO_SOLICITACAO.has(mime) ||
        extensaoArquivoPermitidaSolicitacao(file.name) ||
        mime === "application/octet-stream" ||
        Boolean(porExt) ||
        Boolean(declarado));
    if (!permitido) {
      throw new Error(
        `O arquivo "${file.name}" não é permitido. Use PDF, STL, OBJ, ZIP, DOC ou outros formatos de arquivo/3D.`
      );
    }
    return mime;
  }

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
  opcoes?: {
    forcarBanco?: boolean;
    subpasta?: string;
    modoMime?: "padrao" | "arquivos-solicitacao" | "imagens-solicitacao";
  }
): Promise<ArquivoEnviado[]> {
  if (!files.length) return [];

  const maxBytes =
    opcoes?.modoMime === "arquivos-solicitacao" ||
    opcoes?.modoMime === "imagens-solicitacao" ||
    pasta === "os"
      ? MAX_BYTES_ARQUIVO_GRANDE
      : MAX_BYTES_ARQUIVO;

  for (const file of files) {
    if (file.size > maxBytes) {
      const limiteMb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(
        `O arquivo "${file.name}" excede o limite de ${limiteMb} MB. Reduza o tamanho ou envie outro arquivo.`
      );
    }
  }

  if (
    pasta === "os" ||
    opcoes?.modoMime === "arquivos-solicitacao" ||
    opcoes?.modoMime === "imagens-solicitacao"
  ) {
    const totalBytes = files.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
    if (totalBytes > MAX_BYTES_ARQUIVO_GRANDE) {
      const limiteMb = Math.round(MAX_BYTES_ARQUIVO_GRANDE / (1024 * 1024));
      throw new Error(
        `O total dos arquivos excede o limite de ${limiteMb} MB nesta remessa.`
      );
    }
  }

  const subpasta = (opcoes?.subpasta || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.\s-]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const pastaRemota = subpasta ? `${pasta}/${subpasta}` : pasta;

  carregarEnvArquivoRuntime();
  exigirGoogleDriveSeConfiguradoNoEnv();

  // Google Drive: uploads direto na nuvem (sem disco na VPS).
  if (uploadUsaGoogleDrive()) {
    if (!empresaId) {
      throw new Error("empresaId obrigatório para upload no Google Drive.");
    }
    if (!empresaSlug?.trim()) {
      throw new Error("empresaSlug obrigatório para upload no Google Drive.");
    }
    const empresaIdUpload = empresaId;
    const { garantirPastaModuloUploadGoogleDrive } = await import(
      "@/lib/google-drive-uploads"
    );
    const slug = normalizarSlugPastaUploads(empresaSlug);
    const subpastas = subpasta ? [subpasta] : [];
    await garantirPastaModuloUploadGoogleDrive(slug, pasta, subpastas);

    const preparados = await Promise.all(
      files.map(async (file, index) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        const mimeType = validarMimeUpload(pasta, bytes, file, {
          modoMime: opcoes?.modoMime,
        });
        const filename = `${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2)}-${safeName(file.name)}`;
        return {
          file,
          bytes,
          mimeType,
          filename,
          remotePathLogico: caminhoRemotoUpload(slug, pastaRemota, filename),
        };
      })
    );

    const CONCURRENCY = Math.min(8, preparados.length);
    let cursor = 0;
    const remotePaths = new Array<string>(preparados.length);

    async function workerUpload() {
      while (true) {
        const index = cursor++;
        if (index >= preparados.length) return;
        const item = preparados[index];
        const enviado = await enviarBufferParaGoogleDrive(
          item.remotePathLogico,
          item.bytes,
          item.filename,
          item.mimeType,
          {
            garantirPastas: Boolean(subpasta),
            atualizarCota: false,
            empresaSlug: slug,
            modulo: pasta,
            subpastas,
            nomeArquivo: item.filename,
          }
        );
        remotePaths[index] = enviado.remotePath;
        console.info(`[uploads] Google Drive gravou: ${enviado.remotePath}`);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => workerUpload()));

    const totalBytes = preparados.reduce((s, p) => s + p.bytes.length, 0);
    const { ajustarCotaGoogleDriveAposUpload } = await import(
      "@/lib/google-drive-uploads"
    );
    ajustarCotaGoogleDriveAposUpload(totalBytes);

    const uploaded = await Promise.all(
      preparados.map(async (item, index) => {
        const registro = await prisma.arquivoUpload.create({
          data: {
            empresaId: empresaIdUpload,
            pasta,
            nome: item.file.name,
            mimeType: item.mimeType,
            tamanho: item.bytes.length,
            dados: null,
            storage: "gdrive",
            remotePath: remotePaths[index] || item.remotePathLogico,
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
      const mimeType = validarMimeUpload(pasta, bytes, file, {
        modoMime: opcoes?.modoMime,
      });
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
  const uploadDir = subpasta
    ? path.join(caminhoPastaUploads(slug), pasta, subpasta)
    : path.join(caminhoPastaUploads(slug), pasta);
  await mkdir(uploadDir, { recursive: true });

  const uploaded: ArquivoEnviado[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = validarMimeUpload(pasta, bytes, file, {
      modoMime: opcoes?.modoMime,
    });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(file.name)}`;
    await writeFile(path.join(uploadDir, filename), bytes);
    uploaded.push({
      name: file.name,
      type: mimeType,
      url: subpasta
        ? `/api/uploads/disco/${slug}/${pasta}/${subpasta}/${filename}`
        : urlUploadDisco(slug, pasta, filename),
    });
  }
  return uploaded;
}

export async function lerArquivoUploadPorId(id: string) {
  return prisma.arquivoUpload.findUnique({ where: { id } });
}

/** Lê bytes do registro (banco ou Google Drive). */
export async function obterConteudoArquivoUpload(id: string): Promise<{
  empresaId: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  bytes: Buffer;
} | null> {
  const arquivo = await prisma.arquivoUpload.findUnique({ where: { id } });
  if (!arquivo) return null;

  if (
    (arquivo.storage === "gdrive" || arquivo.storage === "onedrive") &&
    arquivo.remotePath
  ) {
    if (arquivo.storage === "onedrive" && !extrairFileIdGdrive(arquivo.remotePath)) {
      // OneDrive desligado — só funciona se ainda houver bytes no banco.
      const dadosLegado = arquivo.dados;
      if (dadosLegado && dadosLegado.length > 0) {
        const bytes = Buffer.from(dadosLegado);
        return {
          empresaId: arquivo.empresaId,
          nome: arquivo.nome,
          mimeType: arquivo.mimeType,
          tamanho: arquivo.tamanho,
          bytes,
        };
      }
      throw new Error(
        "Arquivo estava no OneDrive (nuvem antiga) e não está mais disponível. Faça o upload novamente."
      );
    }
    if (!googleDriveUploadsConfigurado() && arquivo.storage === "gdrive") {
      throw new Error("Google Drive não configurado para ler este arquivo.");
    }
    const bytes = await baixarArquivoGoogleDrive(arquivo.remotePath);
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
    // URLs antigas /api/uploads/disco/... → Google Drive (estrutura nova).
    const slug = normalizarSlugPastaUploads(empresaSlug);
    const rel = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
    const candidatos = [
      caminhoRemotoUpload(slug, rel.split("/")[0] || "os", rel.split("/").slice(1).join("/")),
      `${slug}/${rel}`,
    ].filter((p) => p && !p.endsWith("/"));

    try {
      const porMeta = await prisma.arquivoUpload.findFirst({
        where: {
          storage: { in: ["gdrive", "onedrive"] },
          OR: [
            ...candidatos.map((remotePath) => ({ remotePath })),
            { remotePath: { endsWith: `/${rel}` } },
            { remotePath: { startsWith: "gdrive:" } },
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
          if (!extrairFileIdGdrive(remotePath) && !remotePath.startsWith("gdrive:")) {
            continue;
          }
          const bytes = await baixarArquivoGoogleDrive(remotePath);
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

  if (
    (row.storage === "gdrive" || row.storage === "onedrive") &&
    row.remotePath
  ) {
    if (row.storage === "gdrive" || extrairFileIdGdrive(row.remotePath)) {
      await excluirArquivoGoogleDrive(row.remotePath, row.tamanho || 0);
    }
    // storage onedrive legado sem fileId Drive: só remove o registro no banco.
  }

  if (empresaId) {
    await prisma.arquivoUpload.deleteMany({ where: { id, empresaId } });
    return;
  }
  await prisma.arquivoUpload.delete({ where: { id } });
}
