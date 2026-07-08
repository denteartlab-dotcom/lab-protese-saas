import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { parsearArquivoContatosDisparo } from "@/lib/whatsapp-disparos/importar-contatos";

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const resumo = await parsearArquivoContatosDisparo(arquivo);
    return NextResponse.json(resumo);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao importar arquivo" },
      { status: 422 }
    );
  }
}
