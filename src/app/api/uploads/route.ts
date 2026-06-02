import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const resumo = await calcularArmazenamentoGaleria();
  return NextResponse.json(resumo);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const { bytesUsados } = await calcularArmazenamentoGaleria();
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
    const uploaded = await salvarArquivosUpload(pasta, files);
    return NextResponse.json(uploaded);
  } catch (err) {
    console.error("POST /api/uploads", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Não foi possível enviar os arquivos. Tente novamente.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
