import { NextResponse } from "next/server";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import { exportarBackupLaboratorio } from "@/lib/backup-laboratorio";

export async function GET() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  try {
    const backup = await exportarBackupLaboratorio(prisma);
    const nomeArquivo = `backup-lab-protese-${new Date().toISOString().slice(0, 10)}.json`;

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
