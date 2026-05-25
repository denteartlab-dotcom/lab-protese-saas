import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { abrirPastaUploadsNoSistema } from "@/lib/uploads-armazenamento-server";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const resultado = await abrirPastaUploadsNoSistema();
  return NextResponse.json(resultado);
}
