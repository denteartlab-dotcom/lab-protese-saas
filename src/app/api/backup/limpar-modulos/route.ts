import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import {
  idsModulosValidos,
  limparModulosSelecionados,
} from "@/lib/limpar-modulos-laboratorio";

const bodySchema = z.object({
  modulos: z.array(z.string()).min(1),
  confirmacao: z.literal("apagar-modulos-selecionados"),
});

export async function POST(request: Request) {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const headerConfirmar =
    request.headers.get("x-backup-confirmar") === "apagar-modulos-selecionados";
  if (!headerConfirmar) {
    return NextResponse.json(
      {
        error:
          "Confirme a operação na tela (digite APAGAR e marque a confirmação).",
      },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Selecione ao menos um módulo e confirme a operação." },
      { status: 400 }
    );
  }

  const ids = idsModulosValidos(parsed.data.modulos);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Nenhum módulo válido selecionado." },
      { status: 400 }
    );
  }

  try {
    const resultado = await limparModulosSelecionados(prisma, ids, {
      usuarioIdManter: auth.session!.id,
    });
    return NextResponse.json({
      ok: true,
      apagados: resultado.apagados,
      localStorageKeys: resultado.localStorageKeys,
      localStoragePrefixos: resultado.localStoragePrefixos,
      modulos: resultado.modulos,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Não foi possível limpar os módulos.";
    console.error("[backup/limpar-modulos]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
