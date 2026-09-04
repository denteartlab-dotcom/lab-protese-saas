import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import { gerarZipBackupEmpresa } from "@/lib/backup-runner-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function autorizarExport() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return { erro: auth.erro };
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return {
      erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }
  return { ctx };
}

/**
 * Download direto do ZIP (JSON + uploads) — caminho principal da UI.
 * Voltou a responder o arquivo na hora, como antes do fluxo por job.
 */
export async function GET() {
  const authz = await autorizarExport();
  if ("erro" in authz && authz.erro) return authz.erro;
  const ctx = authz.ctx!;

  try {
    const { zip, nomeArquivo } = await gerarZipBackupEmpresa(
      ctx.empresaId,
      ctx.empresaSlug
    );

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
    console.error("[backup/export GET]", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o backup." },
      { status: 500 }
    );
  }
}

/** Enfileira exportação ZIP em background (API/legado). */
export async function POST() {
  const authz = await autorizarExport();
  if ("erro" in authz && authz.erro) return authz.erro;
  const ctx = authz.ctx!;

  try {
    const job = await criarJob(ctx.empresaId, "backup_export", {
      empresaSlug: ctx.empresaSlug,
    });
    executarJobEmBackground(job.id, ctx.empresaId);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (err) {
    console.error("[backup/export POST]", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar o backup." },
      { status: 500 }
    );
  }
}
