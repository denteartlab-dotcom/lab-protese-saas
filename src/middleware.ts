import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import { requisicaoTvSocket } from "@/lib/tv/tv-socket-path";
import {
  analisarCaminhoApp,
  caminhoInternoApp,
  montarCaminhoAppComSlug,
} from "@/lib/rotas-app";
import { rotaLiberadaAssinaturaVencida, apiLiberadaAssinaturaVencida } from "@/lib/rotas-assinatura-vencida";

const COOKIE_NAME = "lab-protese-session";
const MASTER_COOKIE_NAME = "lab-protese-master-session";
const PUBLIC = [
  "/",
  "/login",
  "/cadastro",
  "/criar-conta",
  "/recuperar-senha",
  "/redefinir-senha",
  "/limpar-sessao",
  "/admin-master/login",
];

type PayloadSessao = {
  exp?: number;
  id?: string;
  empresaSlug?: string;
  master?: boolean;
  role?: string;
  assinaturaVencida?: boolean;
};

/** Verificação leve no Edge (sem jose — evita erro de build na Vercel). */
function lerPayloadSessao(token: string): PayloadSessao | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as PayloadSessao;
  } catch {
    return null;
  }
}

function sessionTokenAceito(token: string): boolean {
  const payload = lerPayloadSessao(token);
  if (!payload) return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return false;
  }
  return typeof payload.id === "string" && payload.id.length > 0;
}

function masterTokenAceito(token: string): boolean {
  const payload = lerPayloadSessao(token);
  if (!payload) return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return false;
  }
  return (
    payload.master === true &&
    payload.role === "MASTER_ADMIN" &&
    typeof payload.id === "string" &&
    payload.id.length > 0
  );
}

function slugDaSessao(token: string): string | null {
  const payload = lerPayloadSessao(token);
  const slug = payload?.empresaSlug?.trim();
  return slug || null;
}

function assinaturaVencidaNoToken(token: string): boolean {
  const payload = lerPayloadSessao(token);
  return payload?.assinaturaVencida === true;
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

  const destino = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    "https://www.denteartlab.com.br"
  );
  return NextResponse.redirect(destino, 308);
}

function processarRotaApp(
  request: NextRequest,
  pathname: string,
  slugSessao: string | null
): NextResponse | null {
  if (!pathname.startsWith("/app")) return null;

  if (!slugSessao) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return limparCookieSessao(NextResponse.redirect(login));
  }

  const { slug, restante, legado } = analisarCaminhoApp(pathname);
  const search = request.nextUrl.search;

  if (legado) {
    const destino = montarCaminhoAppComSlug(slugSessao, restante) + search;
    if (destino !== pathname + search) {
      return NextResponse.redirect(new URL(destino, request.url));
    }
    return null;
  }

  if (slug !== slugSessao) {
    const destino = montarCaminhoAppComSlug(slugSessao, restante) + search;
    return NextResponse.redirect(new URL(destino, request.url));
  }

  const interno = caminhoInternoApp(restante);
  if (interno === pathname) return null;

  const url = request.nextUrl.clone();
  url.pathname = interno;
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  const redirectWww = redirecionarParaWww(request);
  if (redirectWww) return redirectWww;

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/empresas/cadastro") ||
    pathname === "/api/admin-master/auth/login" ||
    pathname === "/api/version" ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/orcamentos/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/clientes/public")) {
    return NextResponse.next();
  }

  if (pathname === "/api/lab/branding") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/financeiro/fatura-publica/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/financeiro/extrato-publica/")) {
    return NextResponse.next();
  }

  if (
    pathname === "/api/mercadopago/webhook" ||
    pathname === "/api/asaas/webhook"
  ) {
    return NextResponse.next();
  }

  if (requisicaoTvSocket(pathname) || pathname === "/api/tv/socket-health") {
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

  if (pathname.startsWith("/admin-master") || pathname.startsWith("/api/admin-master")) {
    const masterPublico =
      pathname === "/admin-master/login" || pathname === "/api/admin-master/auth/login";
    if (masterPublico) {
      const masterToken = request.cookies.get(MASTER_COOKIE_NAME)?.value;
      if (masterToken && masterTokenAceito(masterToken)) {
        return NextResponse.redirect(new URL("/admin-master", request.url));
      }
      return NextResponse.next();
    }

    const masterToken = request.cookies.get(MASTER_COOKIE_NAME)?.value;
    if (!masterToken || !masterTokenAceito(masterToken)) {
      if (pathname.startsWith("/api/admin-master")) {
        return NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 403 });
      }
      const login = new URL("/admin-master/login", request.url);
      login.searchParams.set("redirect", pathname);
      return NextResponse.redirect(login);
    }

    return NextResponse.next();
  }

  if (PUBLIC.includes(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const res =
      token && !sessionTokenAceito(token)
        ? limparCookieSessao(NextResponse.next())
        : NextResponse.next();

    res.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, max-age=0, must-revalidate"
    );
    res.headers.set("CDN-Cache-Control", "no-store");
    res.headers.set("Vercel-CDN-Cache-Control", "no-store");
    res.headers.set("Pragma", "no-cache");
    return res;
  }

  const rotasRenovacao = rotaLiberadaAssinaturaVencida(pathname);

  if (rotasRenovacao && !pathname.startsWith("/api")) {
    const tokenRenovacao = request.cookies.get(COOKIE_NAME)?.value;
    if (!tokenRenovacao || !sessionTokenAceito(tokenRenovacao)) {
      const login = new URL("/login", request.url);
      login.searchParams.set("redirect", pathname);
      return limparCookieSessao(NextResponse.redirect(login));
    }
    return NextResponse.next();
  }

  const needsAuthLegacy = pathname.startsWith("/app") || pathname.startsWith("/api");

  if (!needsAuthLegacy) {
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

  if (assinaturaVencidaNoToken(token)) {
    if (pathname.startsWith("/app")) {
      return NextResponse.redirect(new URL("/assinatura-vencida", request.url));
    }
    if (pathname.startsWith("/api") && !apiLiberadaAssinaturaVencida(pathname)) {
      return NextResponse.json(
        { error: "Assinatura vencida. Regularize em /assinatura-vencida." },
        { status: 403 }
      );
    }
  }

  if (pathname.startsWith("/app")) {
    const rotaApp = processarRotaApp(request, pathname, slugDaSessao(token));
    if (rotaApp) return rotaApp;
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
