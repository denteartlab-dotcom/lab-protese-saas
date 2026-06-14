import { NextResponse } from "next/server";
import {
  lerArquivoBackupPastaEmpresa,
  nomeArquivoBackupValido,
} from "@/lib/backup-automatico-servidor";
import { exigirProprietario } from "@/lib/exigir-proprietario";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  const arquivo = new URL(request.url).searchParams.get("arquivo")?.trim() || "";
  if (!nomeArquivoBackupValido(arquivo)) {
    return NextResponse.json({ error: "Arquivo de backup inválido." }, { status: 400 });
  }

  const { empresaSlug, empresaNome } = auth.session!;

  try {
    const conteudo = await lerArquivoBackupPastaEmpresa(
      empresaSlug,
      arquivo,
      empresaNome
    );
    return new NextResponse(conteudo, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${arquivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[backup/baixar-arquivo]", err);
    return NextResponse.json(
      { error: "Não foi possível baixar o arquivo de backup." },
      { status: 500 }
    );
  }
}
