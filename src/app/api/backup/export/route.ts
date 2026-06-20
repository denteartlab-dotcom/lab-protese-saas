import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import { exportarBackupEmpresa } from "@/lib/backup-laboratorio";
import {
  coletarUploadsParaZipBackup,
  criarZipBackupEmpresa,
} from "@/lib/backup-zip";

export const maxDuration = 120;

export async function GET() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const backup = await exportarBackupEmpresa(prisma, ctx.empresaId);
    const uploads = await coletarUploadsParaZipBackup(ctx.empresaId, ctx.empresaSlug);
    const zip = await criarZipBackupEmpresa(backup, uploads);
    const data = new Date().toISOString().slice(0, 10);
    const nomeArquivo = `backup-${ctx.empresaSlug}-${data}.zip`;

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": String(zip.length),
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
