import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  caminhoPastaUploads,
  excluirArquivoGaleria,
  listarArquivosGaleria,
} from "@/lib/uploads-armazenamento-server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const arquivos = await listarArquivosGaleria();
  return NextResponse.json({ pasta: caminhoPastaUploads(), arquivos });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get("path")?.trim();
  if (!relativePath) {
    return NextResponse.json({ error: "Informe o arquivo" }, { status: 400 });
  }

  try {
    await excluirArquivoGaleria(relativePath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o arquivo" }, { status: 400 });
  }
}
