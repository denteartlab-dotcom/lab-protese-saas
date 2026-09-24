import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirAdminMasterNoLaboratorio } from "@/lib/exigir-master-admin";
import {
  gerarUrlAutorizacaoGoogleDrive,
  limparCachePastasGoogleDrive,
  trocarCodePorRefreshTokenGoogleDrive,
} from "@/lib/google-drive-shared";
import { garantirPastaDriveEmpresa } from "@/lib/backup-google-drive";

export const dynamic = "force-dynamic";

const schemaCode = z.object({
  code: z.string().min(8),
});

export async function GET() {
  const auth = await exigirAdminMasterNoLaboratorio();
  if (auth.erro) return auth.erro;

  try {
    return NextResponse.json({
      authUrl: gerarUrlAutorizacaoGoogleDrive(),
    });
  } catch (erro) {
    return NextResponse.json(
      {
        error:
          erro instanceof Error
            ? erro.message
            : "Não foi possível iniciar a autorização do Google Drive.",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await exigirAdminMasterNoLaboratorio();
  if (auth.erro) return auth.erro;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = schemaCode.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Cole a URL completa do Google ou o código code=." },
      { status: 400 }
    );
  }

  try {
    await trocarCodePorRefreshTokenGoogleDrive(parsed.data.code);
    limparCachePastasGoogleDrive();

    const pasta = await garantirPastaDriveEmpresa({
      empresaId: auth.session!.empresaId,
      slug: auth.session!.empresaSlug,
      nome: auth.session!.empresaNome,
    });

    if (!pasta.ok) {
      return NextResponse.json(
        {
          error:
            pasta.erro ||
            "Token salvo, mas a pasta backups ainda não pôde ser criada.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      caminhoDrive: pasta.caminhoDrive,
      pastaId: pasta.pastaId,
    });
  } catch (erro) {
    console.error("[backup/gdrive-oauth]", erro);
    return NextResponse.json(
      {
        error:
          erro instanceof Error
            ? erro.message
            : "Não foi possível reconectar o Google Drive.",
      },
      { status: 400 }
    );
  }
}
