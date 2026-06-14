import { NextResponse } from "next/server";
import { caminhoRelativoPastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { listarArquivosPastaBackupEmpresa } from "@/lib/backup-automatico-servidor";
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
    const arquivos = await listarArquivosPastaBackupEmpresa(
      ctx.empresaSlug,
      ctx.empresaNome
    );
    return NextResponse.json({
      pasta: caminhoRelativoPastaBackupEmpresa(ctx.empresaSlug, ctx.empresaNome),
      arquivos,
    });
  } catch (err) {
    console.error("[backup/arquivos-automaticos]", err);
    return NextResponse.json(
      { error: "Não foi possível listar os backups automáticos." },
      { status: 500 }
    );
  }
}
