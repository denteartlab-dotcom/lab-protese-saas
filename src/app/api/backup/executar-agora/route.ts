import { NextResponse } from "next/server";
import { executarBackupAutomatico } from "@/lib/backup-automatico";
import {
  caminhoDriveEmpresa,
  exigirGoogleDriveBackupPronto,
  garantirPastaDriveEmpresa,
} from "@/lib/backup-google-drive";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";

export const dynamic = "force-dynamic";

function hospedagemVercel() {
  return process.env.VERCEL === "1";
}

/** Enfileira backup direto no Google Drive — resposta imediata com jobId. */
export async function POST() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  try {
    exigirGoogleDriveBackupPronto();
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Google Drive não configurado para backup.";
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }

  const { empresaId, empresaSlug, empresaNome } = auth.session!;

  try {
    const pasta = await garantirPastaDriveEmpresa({
      empresaId,
      slug: empresaSlug,
      nome: empresaNome,
    });
    if (!pasta.ok) {
      return NextResponse.json(
        { error: pasta.erro || "Não foi possível criar a pasta backups no Google Drive." },
        { status: 400 }
      );
    }

    const job = await criarJob(empresaId, "backup_servidor", {
      empresaSlug,
      empresaNome,
    });
    executarJobEmBackground(job.id, empresaId);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      pastaPadrao: pasta.caminhoDrive || caminhoDriveEmpresa(empresaSlug, empresaNome),
      destino: "gdrive",
    });
  } catch (erro) {
    console.error("[backup/executar-agora]", erro);
    return NextResponse.json(
      { error: "Não foi possível iniciar o backup no Google Drive." },
      { status: 500 }
    );
  }
}

/** Compatibilidade: execução síncrona legada (cron interno). */
export async function PUT() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  if (hospedagemVercel()) {
    try {
      exigirGoogleDriveBackupPronto();
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : "Indisponível na Vercel.";
      return NextResponse.json({ error: mensagem }, { status: 501 });
    }
  }

  const { empresaId, empresaSlug, empresaNome } = auth.session!;
  const resultado = await executarBackupAutomatico(empresaId, empresaSlug, empresaNome);
  if (!resultado) {
    return NextResponse.json({ error: "Falha ao gerar backup no Google Drive." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...resultado });
}
