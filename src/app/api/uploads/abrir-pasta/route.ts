import { NextResponse } from "next/server";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { abrirPastaUploadsNoSistema } from "@/lib/uploads-armazenamento-server";

export async function POST() {
  const prop = await exigirProprietario();
  if (prop.erro) return prop.erro;

  const resultado = await abrirPastaUploadsNoSistema(prop.session.empresaSlug);
  return NextResponse.json(resultado);
}
