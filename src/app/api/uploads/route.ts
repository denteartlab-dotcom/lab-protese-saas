import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import {
  LIMITE_ARMAZENAMENTO_BYTES,
  LIMITE_GALERIA_GB,
  MENSAGEM_LIMITE_GALERIA_ESGOTADO,
  armazenamentoGaleriaEsgotado,
} from "@/lib/uploads-armazenamento";
import { calcularArmazenamentoGaleria } from "@/lib/uploads-armazenamento-server";
import {
  modoUploadStorage,
  pastaUploadValida,
  salvarArquivosUpload,
} from "@/lib/upload-arquivo-server";
import { onedriveGraphConfigurado } from "@/lib/onedrive-graph";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "produtos", "ver");
  if (negado) return negado;
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
  const negado = await negarSeSemPermissao(ctx, "produtos", "criar");
  if (negado) return negado;

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const resumo = await calcularArmazenamentoGaleria(
      ctx.empresaId,
      ctx.empresaSlug,
      ctx.empresaNome
    );
    const novosBytes = files.reduce((s, f) => s + f.size, 0);
    if (
      armazenamentoGaleriaEsgotado(resumo.bytesLivres) ||
      resumo.bytesUsados + novosBytes > LIMITE_ARMAZENAMENTO_BYTES
    ) {
      return NextResponse.json(
        {
          error: armazenamentoGaleriaEsgotado(resumo.bytesLivres)
            ? MENSAGEM_LIMITE_GALERIA_ESGOTADO
            : `Limite da galeria (${LIMITE_GALERIA_GB} GB) atingido. Libere espaço antes de enviar novos arquivos.`,
        },
        { status: 413 }
      );
    }

    const pasta = pastaUploadValida(new URL(request.url).searchParams.get("pasta"));
    const modo = modoUploadStorage();
    console.info(
      `[uploads] POST pasta=${pasta} modo=${modo} envUPLOAD_STORAGE=${process.env.UPLOAD_STORAGE || "(vazio)"} graph=${onedriveGraphConfigurado()} empresa=${ctx.empresaSlug || "?"} tipos=${files.map((f) => `${f.name}:${f.type || "?"}`).join(",")}`
    );
    const uploaded = await salvarArquivosUpload(
      pasta,
      files,
      ctx.empresaId,
      ctx.empresaSlug
    );
    console.info(
      `[uploads] OK modo=${modo} ${uploaded.length} arquivo(s) urls=${uploaded.map((u) => u.url).join(",")}`
    );
    const res = NextResponse.json(uploaded);
    res.headers.set("X-Upload-Storage", modo);
    return res;
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
