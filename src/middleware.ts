import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
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

function secretJwt(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

/** Verificação completa com jose (HMAC) no Edge. */
async function verificarPayloadSessao(token: string): Promise<PayloadSessao | null> {
  const secret = secretJwt();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as PayloadSessao;
  } catch {
    return null;
  }
}

async function sessionTokenAceito(token: string): Promise<boolean> {
  const payload = await verificarPayloadSessao(token);
  if (!payload) return false;
  return typeof payload.id === "string" && payload.id.length > 0;
}

async function masterTokenAceito(token: string): Promise<boolean> {
  const payload = await verificarPayloadSessao(token);
  if (!payload) return false;
  return (
    payload.master === true &&
    payload.role === "MASTER_ADMIN" &&
    typeof payload.id === "string" &&
    payload.id.length > 0
  );
}

function limparCookieSessao(response: NextResponse) {
  const base = {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  // Limpa host-only e Domain=.denteartlab.com.br (login apex/www).
  response.cookies.set(COOKIE_NAME, "", base);
  response.cookies.set(COOKIE_NAME, "", { ...base, domain: ".denteartlab.com.br" });
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

export async function middleware(request: NextRequest) {
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

  if (
    process.env.NODE_ENV !== "production" &&
    pathname.startsWith("/api/dev/")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/clientes/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/public/")) {
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
    pathname === "/api/asaas/webhook" ||
    pathname === "/api/whatsapp/webhook"
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
      if (masterToken && (await masterTokenAceito(masterToken))) {
        return NextResponse.redirect(new URL("/admin-master", request.url));
      }
      return NextResponse.next();
    }

    const masterToken = request.cookies.get(MASTER_COOKIE_NAME)?.value;
    if (!masterToken || !(await masterTokenAceito(masterToken))) {
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
      token && !(await sessionTokenAceito(token))
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
    if (!tokenRenovacao || !(await sessionTokenAceito(tokenRenovacao))) {
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
  const payloadSessao = token ? await verificarPayloadSessao(token) : null;
  if (!token || !payloadSessao?.id) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return limparCookieSessao(NextResponse.redirect(login));
  }

  if (payloadSessao.assinaturaVencida === true) {
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
    const rotaApp = processarRotaApp(
      request,
      pathname,
      payloadSessao.empresaSlug?.trim() || null
    );
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
