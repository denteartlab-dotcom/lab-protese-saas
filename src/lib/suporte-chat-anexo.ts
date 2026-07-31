import { prisma } from "@/lib/db";
import {
  caminhoRemotoUpload,
  enviarBufferParaOneDrive,
  uploadUsaOneDrive,
} from "@/lib/upload-onedrive-storage";

const MAX_BYTES_IMAGEM = 2 * 1024 * 1024;

const MIMES_IMAGEM = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function mimeDeImagem(file: File) {
  if (file.type?.trim()) return file.type.trim().toLowerCase();
  const nome = file.name.toLowerCase();
  if (/\.(jpe?g)$/.test(nome)) return "image/jpeg";
  if (nome.endsWith(".png")) return "image/png";
  if (nome.endsWith(".webp")) return "image/webp";
  if (nome.endsWith(".gif")) return "image/gif";
  return "";
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-");
}

export async function salvarImagemSuporteChat(
  file: File,
  empresaId: string,
  empresaSlug?: string
) {
  if (file.size > MAX_BYTES_IMAGEM) {
    throw new Error("IMAGEM_GRANDE");
  }

  const mimeType = mimeDeImagem(file);
  if (!MIMES_IMAGEM.has(mimeType)) {
    throw new Error("TIPO_INVALIDO");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const nome = file.name || "imagem-chat";

  if (uploadUsaOneDrive()) {
    let slug = empresaSlug?.trim() || "";
    if (!slug) {
      const emp = await prisma.empresa.findFirst({
        where: { id: empresaId },
        select: { slug: true },
      });
      slug = emp?.slug || "";
    }
    if (!slug) throw new Error("empresaSlug obrigatório para OneDrive");

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(nome)}`;
    const remotePath = caminhoRemotoUpload(slug, "suporte", filename);
    await enviarBufferParaOneDrive(remotePath, bytes, filename, mimeType);
    const registro = await prisma.arquivoUpload.create({
      data: {
        empresaId,
        pasta: "suporte",
        nome,
        mimeType,
        tamanho: bytes.length,
        dados: null,
        storage: "onedrive",
        remotePath,
      },
    });
    return `/api/uploads/arquivo/${registro.id}`;
  }

  const registro = await prisma.arquivoUpload.create({
    data: {
      empresaId,
      pasta: "suporte",
      nome,
      mimeType,
      tamanho: bytes.length,
      dados: bytes,
      storage: "database",
      remotePath: null,
    },
  });

  return `/api/uploads/arquivo/${registro.id}`;
}

export function resumoTextoMensagemSuporte(texto: string, imagemUrl?: string | null) {
  const limpo = texto.trim();
  if (limpo) return limpo;
  if (imagemUrl) return "📷 Imagem";
  return "";
}
