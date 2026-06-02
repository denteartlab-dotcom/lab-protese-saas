import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  LIMITE_ARMAZENAMENTO_BYTES,
  LIMITE_GALERIA_GB,
} from "@/lib/uploads-armazenamento";
import { calcularArmazenamentoGaleria } from "@/lib/uploads-armazenamento-server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const resumo = await calcularArmazenamentoGaleria();
  return NextResponse.json(resumo);
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-");
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);
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

  const subpasta =
    new URL(request.url).searchParams.get("pasta") === "despesas" ? "despesas" : "os";
  const uploadDir = path.join(process.cwd(), "public", "uploads", subpasta);
  await mkdir(uploadDir, { recursive: true });

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(file.name)}`;
      await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

      return {
        name: file.name,
        type: file.type,
        url: `/uploads/${subpasta}/${filename}`,
      };
    })
  );

  return NextResponse.json(uploaded);
}
