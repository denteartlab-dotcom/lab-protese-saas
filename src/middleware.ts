import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import { requisicaoTvSocket } from "@/lib/tv/tv-socket-client";

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
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function redirecionarParaWww(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host !== "denteartlab.com.br") return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = "www.denteartlab.com.br";
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const redirectWww = redirecionarParaWww(request);
  if (redirectWww) return redirectWww;

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname === "/api/version"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/orcamentos/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/clientes/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/financeiro/fatura-publica/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/financeiro/extrato-publica/")) {
    return NextResponse.next();
  }

  if (requisicaoTvSocket(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/fatura/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/extrato/")) {
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
    const res = NextResponse.next();
    res.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, max-age=0, must-revalidate"
    );
    res.headers.set("CDN-Cache-Control", "no-store");
    res.headers.set("Vercel-CDN-Cache-Control", "no-store");
    res.headers.set("Pragma", "no-cache");
    return res;
  }

  const needsAuth = pathname.startsWith("/app") || pathname.startsWith("/api");

  if (!needsAuth) {
    const res = NextResponse.next();
    if (pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i)) {
      res.headers.set("Cache-Control", "public, max-age=86400, must-revalidate");
    }
    return res;
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

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  if (pathname.startsWith("/api")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/image|favicon.ico).*)"],
};
