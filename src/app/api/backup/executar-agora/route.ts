import { NextResponse } from "next/server";
import { executarBackupAutomatico } from "@/lib/backup-automatico";
import {
  caminhoRelativoPastaBackupEmpresa,
  caminhoRelativoUploadsBackupEmpresa,
} from "@/lib/backup-empresa-pasta";
import { onedriveBackupSyncHabilitado } from "@/lib/backup-onedrive-sync";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";

export const dynamic = "force-dynamic";

function hospedagemVercel() {
  return process.env.VERCEL === "1";
}

/** Enfileira backup no servidor — resposta imediata com jobId (issue 026). */
export async function POST() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  if (hospedagemVercel()) {
    return NextResponse.json(
      {
        error:
          "Backup na pasta do servidor não está disponível na Vercel. Use «Baixar backup» para salvar no computador.",
      },
      { status: 501 }
    );
  }

  const { empresaId, empresaSlug, empresaNome } = auth.session!;

  try {
    const job = await criarJob(empresaId, "backup_servidor", {
      empresaSlug,
      empresaNome,
    });
    executarJobEmBackground(job.id, empresaId);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      pastaPadrao: caminhoRelativoPastaBackupEmpresa(empresaSlug, empresaNome),
      pastaUploads: caminhoRelativoUploadsBackupEmpresa(empresaSlug, empresaNome),
      onedrive: { habilitado: onedriveBackupSyncHabilitado() },
    });
  } catch (erro) {
    console.error("[backup/executar-agora]", erro);
    return NextResponse.json(
      { error: "Não foi possível iniciar o backup no servidor." },
      { status: 500 }
    );
  }
}

/** Compatibilidade: execução síncrona legada (cron interno). */
export async function PUT() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  if (hospedagemVercel()) {
    return NextResponse.json({ error: "Indisponível na Vercel." }, { status: 501 });
  }

  const { empresaId, empresaSlug, empresaNome } = auth.session!;
  const resultado = await executarBackupAutomatico(empresaId, empresaSlug, empresaNome);
  if (!resultado) {
    return NextResponse.json({ error: "Falha ao gerar backup." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...resultado });
}
