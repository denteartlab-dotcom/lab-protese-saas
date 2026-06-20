import { NextResponse } from "next/server";
import { executarBackupAutomatico } from "@/lib/backup-automatico";
import {
  caminhoRelativoPastaBackupEmpresa,
  caminhoRelativoUploadsBackupEmpresa,
} from "@/lib/backup-empresa-pasta";
import { onedriveBackupSyncHabilitado } from "@/lib/backup-onedrive-sync";
import { exigirProprietario } from "@/lib/exigir-proprietario";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function hospedagemVercel() {
  return process.env.VERCEL === "1";
}

/** Gera backup completo na pasta do servidor (JSON + uploads/) e opcionalmente envia ao OneDrive. */
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
    const resultado = await executarBackupAutomatico(
      empresaId,
      empresaSlug,
      empresaNome
    );

    if (!resultado) {
      return NextResponse.json(
        {
          error:
            "Não foi possível gerar o backup no servidor. Verifique os logs ou tente novamente em instantes.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      destino: resultado.destino,
      exportedAt: resultado.exportedAt,
      pastaPadrao: caminhoRelativoPastaBackupEmpresa(empresaSlug, empresaNome),
      pastaUploads: caminhoRelativoUploadsBackupEmpresa(empresaSlug, empresaNome),
      uploadsArquivos: resultado.uploadsArquivos ?? 0,
      onedrive: {
        habilitado: onedriveBackupSyncHabilitado(),
        sincronizado: resultado.onedrive?.ok === true,
        erro:
          resultado.onedrive?.ok === false && resultado.onedrive.erro !== "desativado"
            ? resultado.onedrive.erro
            : null,
      },
    });
  } catch (erro) {
    console.error("[backup/executar-agora]", erro);
    return NextResponse.json(
      { error: "Não foi possível gerar o backup no servidor." },
      { status: 500 }
    );
  }
}
