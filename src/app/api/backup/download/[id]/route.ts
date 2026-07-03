import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { lerBackupZipTemp } from "@/lib/backup-temp-servidor";
import { obterJobTenant } from "@/lib/jobs/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const job = await obterJobTenant(ctx.empresaId, id);
  if (!job || job.tipo !== "backup_export" || job.status !== "concluido") {
    return NextResponse.json({ error: "Backup não disponível." }, { status: 404 });
  }

  const arquivo = await lerBackupZipTemp(ctx.empresaId, id);
  if (!arquivo) {
    return NextResponse.json({ error: "Arquivo expirado ou não encontrado." }, { status: 410 });
  }

  return new NextResponse(new Uint8Array(arquivo.zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${arquivo.nomeArquivo}"`,
      "Content-Length": String(arquivo.zip.length),
      "Cache-Control": "no-store",
    },
  });
}
