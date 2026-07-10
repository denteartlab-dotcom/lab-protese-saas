import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
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
  const arquivo = await runWithTenantContext(empresaId, () =>
    prisma.arquivoUpload.findFirst({
      where: { id: uploadId, empresaId },
      select: { dados: true, mimeType: true, nome: true },
    })
  );
  if (!arquivo) return null;
  return {
    mimeType: arquivo.mimeType,
    fileName: arquivo.nome,
    dataBase64: Buffer.from(arquivo.dados).toString("base64"),
  };
}
