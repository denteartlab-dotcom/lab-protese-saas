import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  caminhoPastaUploads,
  excluirArquivoGaleria,
  listarArquivosGaleria,
} from "@/lib/uploads-armazenamento-server";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const arquivos = await listarArquivosGaleria(ctx.empresaId, ctx.empresaSlug);
  return NextResponse.json({ pasta: caminhoPastaUploads(ctx.empresaSlug), arquivos });
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: { paths?: unknown };
  try {
    body = (await request.json()) as { paths?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "Informe os arquivos" }, { status: 400 });
  }

  const erros: string[] = [];
  for (const relativePath of paths) {
    try {
      await excluirArquivoGaleria(relativePath.trim(), ctx.empresaId, ctx.empresaSlug);
    } catch {
      erros.push(relativePath);
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    excluidos: paths.length - erros.length,
    erros,
  });
}

export async function DELETE(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get("path")?.trim();
  if (!relativePath) {
    return NextResponse.json({ error: "Informe o arquivo" }, { status: 400 });
  }

  try {
    await excluirArquivoGaleria(relativePath, ctx.empresaId, ctx.empresaSlug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o arquivo" }, { status: 400 });
  }
}
