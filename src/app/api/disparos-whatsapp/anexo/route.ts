import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { salvarArquivosUpload } from "@/lib/upload-arquivo-server";

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    // Campanha lê o anexo pelo id no banco (campaign-queue) — forçar DB mesmo em modo disco.
    const salvos = await salvarArquivosUpload(
      "disparos-whatsapp",
      [arquivo],
      ctx.empresaId,
      ctx.empresaSlug,
      { forcarBanco: true }
    );
    const item = salvos[0];
    if (!item) return NextResponse.json({ error: "Falha ao salvar anexo" }, { status: 500 });

    const uploadId = item.url.match(/\/api\/uploads\/arquivo\/([^/]+)/)?.[1] || null;
    if (!uploadId) {
      return NextResponse.json(
        { error: "Anexo sem id no banco — não pode ser usado na campanha." },
        { status: 500 }
      );
    }

    let anexoTipo: string = "documento";
    if (arquivo.type.startsWith("image/")) anexoTipo = "imagem";
    else if (arquivo.type.startsWith("video/")) anexoTipo = "video";
    else if (arquivo.type.startsWith("audio/")) anexoTipo = "audio";
    else if (arquivo.type === "application/pdf") anexoTipo = "pdf";

    return NextResponse.json({
      ok: true,
      anexo: {
        uploadId,
        nome: item.name,
        mimeType: arquivo.type,
        tipo: anexoTipo,
        url: item.url,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar anexo" },
      { status: 500 }
    );
  }
}
