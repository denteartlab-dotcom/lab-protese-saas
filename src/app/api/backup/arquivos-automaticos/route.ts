import { NextResponse } from "next/server";
import { listarArquivosBackupFonte } from "@/lib/backup-arquivos-fonte";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const lista = await listarArquivosBackupFonte({
      empresaId: ctx.empresaId,
      slug: ctx.empresaSlug,
      nome: ctx.empresaNome,
    });
    return NextResponse.json({
      pasta: lista.pasta,
      origem: lista.origem,
      arquivos: lista.arquivos,
    });
  } catch (err) {
    console.error("[backup/arquivos-automaticos]", err);
    return NextResponse.json(
      { error: "Não foi possível listar os backups automáticos." },
      { status: 500 }
    );
  }
}
