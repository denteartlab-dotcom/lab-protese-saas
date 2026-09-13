import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import {
  anexarCookieSessao,
  COOKIE_NAME,
  getSession,
  sessaoEhSuporteMaster,
  SESSAO_TTL_SUPORTE_MASTER_S,
} from "@/lib/auth";
import {
  SESSAO_TTL_LEMBRAR_S,
  SESSAO_TTL_SEM_LEMBRAR_S,
} from "@/lib/auth-token";
import { sessaoUsuarioVersaoValida } from "@/lib/session-version";

/**
 * Renova o cookie JWT com o mesmo TTL da sessão atual.
 * Usado pelo Módulo TV para kiosk sem logout por TTL absoluto.
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

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
      const payload = decodeJwt(token);
      if (
        typeof payload.iat === "number" &&
        typeof payload.exp === "number" &&
        payload.exp > payload.iat
      ) {
        const ttlOriginal = Math.floor(payload.exp - payload.iat);
        if (ttlOriginal >= SESSAO_TTL_LEMBRAR_S * 0.9) {
          ttlSegundos = SESSAO_TTL_LEMBRAR_S;
        } else if (ttlOriginal >= 60) {
          ttlSegundos = Math.min(
            Math.max(ttlOriginal, SESSAO_TTL_SEM_LEMBRAR_S),
            SESSAO_TTL_LEMBRAR_S
          );
        }
      }
    }
  } catch {
    /* usa default */
  }

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
