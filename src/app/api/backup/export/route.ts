import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import { exportarBackupEmpresa } from "@/lib/backup-laboratorio";

export async function GET() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const backup = await exportarBackupEmpresa(prisma, ctx.empresaId);
    const nomeArquivo = `backup-${ctx.empresaSlug}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[backup/export]", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o backup." },
      { status: 500 }
    );
  }
}
