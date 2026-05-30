import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "lab-protese-session";
const PUBLIC = ["/login"];

/** Verificação leve no Edge (sem jose — evita erro de build na Vercel). */
function sessionTokenAceito(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number; id?: string };
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return false;
    }
    return typeof payload.id === "string" && payload.id.length > 0;
  } catch {
    return false;
  }
}

function limparCookieSessao(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/setup")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/orcamentos/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/clientes/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/orcamento/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/acompanhamento/")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (PUBLIC.includes(pathname)) {
    // Limpa cookie ao abrir login — evita loop com token antigo ou JWT_SECRET diferente.
    return limparCookieSessao(NextResponse.next());
  }

  const needsAuth = pathname.startsWith("/app") || pathname.startsWith("/api");

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !sessionTokenAceito(token)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return limparCookieSessao(NextResponse.redirect(login));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
