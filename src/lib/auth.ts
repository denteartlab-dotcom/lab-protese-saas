import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  anexarSetCookiesMesmoNome,
  listarValoresCookie,
  serializarSetCookie,
} from "@/lib/cookie-sessao-bruto";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import {
  COOKIE_NAME,
  criarTokenSessao,
  getSessionFromCookieHeader,
  sessaoEhSuporteMaster,
  SESSAO_TTL_SUPORTE_MASTER_S,
  ttlSessaoSegundos,
  verifySessionToken,
  type SessionUser,
} from "@/lib/auth-token";
import { sessaoUsuarioVersaoValida } from "@/lib/session-version";

export type { SessionUser } from "@/lib/auth-token";
export {
  COOKIE_NAME,
  getSessionFromCookieHeader,
  sessaoEhSuporteMaster,
  SESSAO_TTL_SUPORTE_MASTER_S,
  verifySessionToken,
} from "@/lib/auth-token";

/** Cost 12 para hashes novos; hashes antigos (cost 10) continuam válidos no compare. */
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Apex + www compartilham o mesmo cookie (evita “sessão não confirmada”). */
export function dominioCookieSessao(request?: Request): string | undefined {
  const hosts: string[] = [];
  const hostHeader = request?.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (hostHeader) hosts.push(hostHeader);
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.URL_PUBLICA_DO_APP?.trim(),
  ]) {
    if (!raw) continue;
    try {
      const h = new URL(raw).hostname.toLowerCase();
      if (h) hosts.push(h);
    } catch {
      /* ignora */
    }
  }
  // Preferir .env: atrás do nginx o Host às vezes vem 127.0.0.1 e o cookie
  // ficava host-only no www após 301 apex→www — /api/auth/me no apex falhava.
  for (const host of hosts) {
    if (
      host === "denteartlab.com.br" ||
      host === "www.denteartlab.com.br" ||
      host.endsWith(".denteartlab.com.br")
    ) {
      return ".denteartlab.com.br";
    }
  }
  if (process.env.NODE_ENV === "production") {
    return ".denteartlab.com.br";
  }
  return undefined;
}

export function opcoesCookieSessao(
  maxAge: number,
  request?: Request
): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
} {
  const domain = dominioCookieSessao(request);
  return {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

function maxAgeSessao(
  user: SessionUser,
  options?: { remember?: boolean; ttlSegundos?: number }
) {
  if (options?.ttlSegundos != null) return options.ttlSegundos;
  if (sessaoEhSuporteMaster(user)) {
    if (user.suporteExpiraEm && user.suporteExpiraEm > Date.now()) {
      return Math.max(1, Math.floor((user.suporteExpiraEm - Date.now()) / 1000));
    }
    return SESSAO_TTL_SUPORTE_MASTER_S;
  }
  return ttlSessaoSegundos(options?.remember);
}

export async function createSession(
  user: SessionUser,
  options?: { remember?: boolean; request?: Request; ttlSegundos?: number }
) {
  const maxAge = maxAgeSessao(user, options);
  const token = await criarTokenSessao(user, {
    remember: options?.remember,
    ttlSegundos: maxAge,
  });

  const cookieStore = await cookies();
  const opcoes = opcoesCookieSessao(maxAge, options?.request);
  // cookies().set só guarda um nome: o token com Domain fica; a limpeza
  // host-only sai em anexarCookieSessao, que escreve os dois Set-Cookie.
  cookieStore.set(COOKIE_NAME, token, opcoes);
}

/** Preferível em Route Handlers: grava Set-Cookie na resposta HTTP. */
export async function anexarCookieSessao(
  response: NextResponse,
  user: SessionUser,
  options?: { remember?: boolean; request?: Request; ttlSegundos?: number }
) {
  const maxAge = maxAgeSessao(user, options);
  const token = await criarTokenSessao(user, {
    remember: options?.remember,
    ttlSegundos: maxAge,
  });
  const opcoes = opcoesCookieSessao(maxAge, options?.request);
  const linhas = [serializarSetCookie(COOKIE_NAME, token, opcoes)];
  // Host-only antigo chega antes do Domain e o servidor lia a sessão vencida.
  if (opcoes.domain) {
    linhas.unshift(
      serializarSetCookie(COOKIE_NAME, "", {
        httpOnly: true,
        secure: opcoes.secure,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
    );
  }
  anexarSetCookiesMesmoNome(response.headers, COOKIE_NAME, linhas);
  return response;
}

export async function destroySession(request?: Request) {
  const cookieStore = await cookies();
  const base = opcoesCookieSessao(0, request);
  // Limpa host-only e Domain=.denteartlab.com.br (legado apex/www).
  cookieStore.set(COOKIE_NAME, "", { ...base, domain: undefined });
  cookieStore.set(COOKIE_NAME, "", base);
}

export async function anexarLimpezaCookieSessao(
  response: NextResponse,
  request?: Request
) {
  const base = opcoesCookieSessao(0, request);
  const limpo = {
    httpOnly: true as const,
    secure: base.secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  const linhas = [serializarSetCookie(COOKIE_NAME, "", limpo)];
  if (base.domain) {
    linhas.push(serializarSetCookie(COOKIE_NAME, "", { ...limpo, domain: base.domain }));
  }
  anexarSetCookiesMesmoNome(response.headers, COOKIE_NAME, linhas);
  return response;
}

async function tokensSessaoDaRequisicao(): Promise<string[]> {
  try {
    const lista = await headers();
    const varios = listarValoresCookie(lista.get("cookie"), COOKIE_NAME);
    if (varios.length) return varios;
  } catch {
    /* fora de um request */
  }
  const cookieStore = await cookies();
  const unico = cookieStore.get(COOKIE_NAME)?.value;
  return unico ? [unico] : [];
}

export async function getSession(): Promise<SessionUser | null> {
  const tokens = await tokensSessaoDaRequisicao();
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const session = await verifySessionToken(tokens[i]);
    if (!session) continue;
    const ok = await sessaoUsuarioVersaoValida(session.id, session.sessionVersion);
    if (ok) return session;
  }
  return null;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export { rotuloPapelUsuario } from "@/lib/auth-client";
