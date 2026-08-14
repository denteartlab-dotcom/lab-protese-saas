import { NextResponse } from "next/server";
import { anexarLimpezaCookieSessao, getSession } from "@/lib/auth";
import { bumpSessionVersionUsuario } from "@/lib/session-version";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";

/** Invalida todas as sessões JWT do usuário (incrementa sessionVersion) e limpa cookie local. */
export async function POST(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    await bumpSessionVersionUsuario(session.id);
  } catch (err) {
    console.error("[logout-todos]", err);
    return NextResponse.json({ error: "Não foi possível encerrar as sessões." }, { status: 500 });
  }

  const resposta = NextResponse.json({
    ok: true,
    message: "Todas as sessões foram encerradas.",
  });
  return anexarLimpezaCookieSessao(resposta, request);
}
