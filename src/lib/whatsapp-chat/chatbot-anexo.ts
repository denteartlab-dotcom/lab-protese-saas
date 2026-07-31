import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import { obterConteudoArquivoUpload } from "@/lib/upload-arquivo-server";
import type { RespostaChatMidia } from "@/lib/whatsapp-chat/chatbot-config-types";

export async function carregarAnexoChatbot(
  uploadId: string | null | undefined,
  empresaId: string
): Promise<RespostaChatMidia | null> {
  if (!uploadId?.trim()) return null;
  const arquivo = await runWithTenantContext(empresaId, () =>
    prisma.arquivoUpload.findFirst({
      where: { id: uploadId.trim(), empresaId },
      select: { id: true, mimeType: true, nome: true },
    })
  );
  if (!arquivo) return null;

  let tipo: RespostaChatMidia["tipo"] = "documento";
  if (arquivo.mimeType.startsWith("image/")) tipo = "imagem";
  else if (arquivo.mimeType === "application/pdf") tipo = "pdf";

  return {
    uploadId: arquivo.id,
    mimeType: arquivo.mimeType,
    fileName: arquivo.nome,
    tipo,
  };
}

export async function carregarBase64AnexoChatbot(uploadId: string, empresaId: string) {
  const meta = await runWithTenantContext(empresaId, () =>
    prisma.arquivoUpload.findFirst({
      where: { id: uploadId, empresaId },
      select: { id: true },
    })
  );
  if (!meta) return null;

  const conteudo = await obterConteudoArquivoUpload(meta.id);
  if (!conteudo || conteudo.empresaId !== empresaId) return null;

  return {
    mimeType: conteudo.mimeType,
    fileName: conteudo.nome,
    dataBase64: conteudo.bytes.toString("base64"),
  };
}
