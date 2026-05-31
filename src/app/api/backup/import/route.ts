import { NextResponse } from "next/server";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import {
  importarBackupLaboratorio,
  validarBackupLaboratorio,
} from "@/lib/backup-laboratorio";

const MAX_BYTES = 80 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const confirmar = request.headers.get("x-backup-confirmar") === "substituir-tudo";
  if (!confirmar) {
    return NextResponse.json(
      {
        error:
          "Confirme a substituição dos dados (marque a opção na tela antes de importar).",
      },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    const texto = await request.text();
    if (texto.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "Arquivo de backup muito grande (máx. 80 MB)." },
        { status: 413 }
      );
    }
    body = JSON.parse(texto);
  } catch {
    return NextResponse.json(
      { error: "Arquivo JSON inválido." },
      { status: 400 }
    );
  }

  const backup = validarBackupLaboratorio(body);
  if (!backup) {
    return NextResponse.json(
      { error: "Backup incompatível ou corrompido." },
      { status: 400 }
    );
  }

  try {
    const resultado = await importarBackupLaboratorio(prisma, backup);
    return NextResponse.json({
      ok: true,
      exportedAt: backup.exportedAt,
      contagens: resultado.contagens,
    });
  } catch (err) {
    console.error("[backup/import]", err);
    return NextResponse.json(
      {
        error:
          "Falha ao importar backup. Os dados podem estar inconsistentes — restaure outro backup ou contate o suporte.",
      },
      { status: 500 }
    );
  }
}
