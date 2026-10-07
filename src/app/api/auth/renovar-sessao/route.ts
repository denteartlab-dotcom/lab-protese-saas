import { NextResponse } from "next/server";
import {
  anexarCookieSessao,
  getSession,
  sessaoEhSuporteMaster,
  SESSAO_TTL_SUPORTE_MASTER_S,
} from "@/lib/auth";
import { SESSAO_TTL_SEM_LEMBRAR_S } from "@/lib/auth-token";
import { sessaoUsuarioVersaoValida } from "@/lib/session-version";

/**
 * Renova o cookie JWT (2h a partir de agora).
 * Com o site fechado o cookie anterior expira sozinho; com o sistema em uso, a sessão desliza.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const versaoOk = await sessaoUsuarioVersaoValida(session);
  if (!versaoOk) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  if (
    sessaoEhSuporteMaster(session) &&
    session.suporteExpiraEm &&
    session.suporteExpiraEm <= Date.now()
  ) {
    return NextResponse.json({ error: "Suporte expirado" }, { status: 401 });
  }

  let ttlSegundos = sessaoEhSuporteMaster(session)
    ? SESSAO_TTL_SUPORTE_MASTER_S
    : SESSAO_TTL_SEM_LEMBRAR_S;

  if (sessaoEhSuporteMaster(session) && session.suporteExpiraEm) {
    ttlSegundos = Math.max(
      1,
      Math.min(
        ttlSegundos,
        Math.floor((session.suporteExpiraEm - Date.now()) / 1000)
      )
    );
  }

  const resposta = NextResponse.json({ ok: true });
  return anexarCookieSessao(resposta, session, {
    request,
    ttlSegundos,
  });
}
