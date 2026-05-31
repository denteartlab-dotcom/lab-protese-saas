import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { TODOS_DENTES_DECIDUOS } from "@/lib/dentes-imagens";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { numero } = await params;
  if (!TODOS_DENTES_DECIDUOS.includes(numero as (typeof TODOS_DENTES_DECIDUOS)[number])) {
    return NextResponse.json({ error: "Dente decíduo inválido" }, { status: 404 });
  }

  const imagePath = path.join(
    process.cwd(),
    "public",
    "dentes-deciduos",
    `dente-${numero}.png`
  );

  try {
    const file = await readFile(imagePath);
    return new Response(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
  }
}
