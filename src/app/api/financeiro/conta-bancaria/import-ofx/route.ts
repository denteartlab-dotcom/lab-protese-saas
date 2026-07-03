import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Importação OFX em background (issue 011). Rota legada: POST /api/contas-bancarias/ofx */
export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: "Arquivo OFX não enviado." }, { status: 400 });
    }

    const nome = arquivo.name.toLowerCase();
    if (!nome.endsWith(".ofx") && !nome.endsWith(".qfx")) {
      return NextResponse.json(
        { error: "Somente arquivos OFX são aceitos." },
        { status: 400 }
      );
    }

    const texto = await arquivo.text();
    const job = await criarJob(ctx.empresaId, "import_ofx", {
      texto,
      nomeArquivo: arquivo.name,
    });
    executarJobEmBackground(job.id, ctx.empresaId);

    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (err) {
    console.error("[financeiro/conta-bancaria/import-ofx POST]", err);
    return NextResponse.json({ error: "Falha ao enfileirar importação OFX." }, { status: 500 });
  }
}
