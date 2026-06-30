import { prisma } from "@/lib/db";

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

export async function salvarImagemSuporteChat(file: File, empresaId: string) {
  if (file.size > MAX_BYTES_IMAGEM) {
    throw new Error("IMAGEM_GRANDE");
  }

  const mimeType = mimeDeImagem(file);
  if (!MIMES_IMAGEM.has(mimeType)) {
    throw new Error("TIPO_INVALIDO");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const registro = await prisma.arquivoUpload.create({
    data: {
      empresaId,
      pasta: "suporte",
      nome: file.name || "imagem-chat",
      mimeType,
      tamanho: bytes.length,
      dados: bytes,
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
