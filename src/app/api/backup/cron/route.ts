import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executarBackupAutomatico } from "@/lib/backup-automatico";
import { carregarConfigBackupAutomatico } from "@/lib/backup-automatico-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return false;

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${segredo}`) return true;

  const query = new URL(request.url).searchParams.get("secret");
  return query === segredo;
}

/** Dispara backup de todas as empresas ativas (cron externo). */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const empresas = await prisma.empresa.findMany({
      where: { status: "ativo" },
      select: { id: true, slug: true, nome: true },
    });

    const resultados: Array<{
      slug: string;
      ok: boolean;
      destino?: string;
      motivo?: string;
    }> = [];

    for (const empresa of empresas) {
      const config = await carregarConfigBackupAutomatico(empresa.id);
      if (!config.ativo) {
        resultados.push({
          slug: empresa.slug,
          ok: false,
          motivo: "Backup automático desativado.",
        });
        continue;
      }

      const resultado = await executarBackupAutomatico(
        empresa.id,
        empresa.slug,
        empresa.nome
      );
      if (!resultado) {
        resultados.push({
          slug: empresa.slug,
          ok: false,
          motivo: "Execução em andamento ou falha.",
        });
        continue;
      }

      resultados.push({
        slug: empresa.slug,
        ok: true,
        destino: resultado.destino,
      });
    }

    return NextResponse.json({ ok: true, empresas: resultados });
  } catch (erro) {
    console.error("[backup/cron]", erro);
    return NextResponse.json(
      { error: "Não foi possível gerar o backup." },
      { status: 500 }
    );
  }
}
