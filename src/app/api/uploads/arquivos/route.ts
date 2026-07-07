import { NextResponse } from "next/server";
import { parseBrDate } from "@/lib/datas-br";
import { requireEmpresaContext } from "@/lib/empresa-context";
import type { ArquivoGaleriaItem } from "@/lib/galeria-uploads-types";
import {
  caminhoPastaUploads,
  excluirArquivoGaleria,
  listarArquivosGaleria,
} from "@/lib/uploads-armazenamento-server";

function filtrarArquivosPorPeriodo(
  arquivos: ArquivoGaleriaItem[],
  de?: string | null,
  ate?: string | null
) {
  const inicio = de?.trim() ? parseBrDate(de.trim()) : null;
  const fim = ate?.trim() ? parseBrDate(ate.trim()) : null;
  if (!inicio && !fim) return arquivos;

  if (fim) fim.setHours(23, 59, 59, 999);
  if (inicio) inicio.setHours(0, 0, 0, 0);

  return arquivos.filter((arq) => {
    const data = new Date(arq.criadoEm);
    if (Number.isNaN(data.getTime())) return true;
    if (inicio && data < inicio) return false;
    if (fim && data > fim) return false;
    return true;
  });
}

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");

  const todos = await listarArquivosGaleria(ctx.empresaId, ctx.empresaSlug);
  const arquivos = filtrarArquivosPorPeriodo(todos, de, ate);

  return NextResponse.json({ pasta: caminhoPastaUploads(ctx.empresaSlug), arquivos, total: todos.length });
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
