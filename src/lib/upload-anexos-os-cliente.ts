import type { AnexoOs } from "@/lib/os-anexos";
import { notificarUploadsAtualizados } from "@/lib/uploads-armazenamento";

export function chaveArquivoOs(arquivo: File) {
  return `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`;
}

/** Sobe anexos da OS. Usado ao escolher o arquivo, não na hora de gravar. */
export async function enviarArquivosOs(
  arquivos: File[],
  signal?: AbortSignal
): Promise<AnexoOs[]> {
  if (!arquivos.length) return [];
  const formData = new FormData();
  arquivos.forEach((arquivo) => formData.append("files", arquivo));

  const response = await fetch("/api/uploads?pasta=os", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    const { lerErroUploadResponse, tratarErroUploadArmazenamento } = await import(
      "@/lib/uploads-erro-armazenamento"
    );
    const err = await lerErroUploadResponse(response);
    tratarErroUploadArmazenamento(err);
    throw new Error(err.message);
  }

  const uploaded = await response.json();
  const lista = (Array.isArray(uploaded) ? uploaded : []) as Array<{
    name?: string;
    type?: string;
    url?: string;
  }>;
  notificarUploadsAtualizados();
  return lista
    .filter((item) => item?.url)
    .map((item, index) => ({
      name: item.name || arquivos[index]?.name || "Arquivo",
      type: item.type || arquivos[index]?.type || "",
      url: item.url as string,
      tamanho: arquivos[index]?.size,
    }));
}
