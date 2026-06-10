import { NextResponse } from "next/server";
import { executarBackupAutomatico } from "@/lib/backup-automatico";

export const dynamic = "force-dynamic";

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return false;

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${segredo}`) return true;

  const query = new URL(request.url).searchParams.get("secret");
  return query === segredo;
}

/** Dispara backup manualmente (cron externo, GitHub Actions, etc.). */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const resultado = await executarBackupAutomatico();
    if (!resultado) {
      return NextResponse.json(
        { error: "Backup já em execução." },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      destino: resultado.destino,
      exportedAt: resultado.exportedAt,
    });
  } catch (erro) {
    console.error("[backup/cron]", erro);
    return NextResponse.json(
      { error: "Não foi possível gerar o backup." },
      { status: 500 }
    );
  }
}
