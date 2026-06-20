import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  LIMITE_ARMAZENAMENTO_BYTES,
  LIMITE_GALERIA_GB,
} from "@/lib/uploads-armazenamento";
import { calcularArmazenamentoGaleria } from "@/lib/uploads-armazenamento-server";
import {
  pastaUploadValida,
  salvarArquivosUpload,
} from "@/lib/upload-arquivo-server";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const resumo = await calcularArmazenamentoGaleria(
    ctx.empresaId,
    ctx.empresaSlug,
    ctx.empresaNome
  );
  return NextResponse.json(resumo);
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const { bytesUsados } = await calcularArmazenamentoGaleria(
      ctx.empresaId,
      ctx.empresaSlug,
      ctx.empresaNome
    );
    const novosBytes = files.reduce((s, f) => s + f.size, 0);
    if (bytesUsados + novosBytes > LIMITE_ARMAZENAMENTO_BYTES) {
      return NextResponse.json(
        {
          error: `Limite da galeria (${LIMITE_GALERIA_GB} GB) atingido. Libere espaço antes de enviar novos arquivos.`,
        },
        { status: 413 }
      );
    }

    const pasta = pastaUploadValida(new URL(request.url).searchParams.get("pasta"));
    const uploaded = await salvarArquivosUpload(
      pasta,
      files,
      ctx.empresaId,
      ctx.empresaSlug
    );
    return NextResponse.json(uploaded);
  } catch (err) {
    console.error("POST /api/uploads", err);
    const prismaCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    const msg = err instanceof Error ? err.message : "Erro ao enviar arquivos.";
    return NextResponse.json(
      { error: msg, code: prismaCode || undefined },
      { status: 500 }
    );
  }
}
