import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import { gerarNonceCsp, montarContentSecurityPolicy } from "@/lib/csp";
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

function secretsMasterJwt(): Uint8Array[] {
  const out: Uint8Array[] = [];
  const master = process.env.MASTER_JWT_SECRET?.trim();
  const jwt = process.env.JWT_SECRET?.trim();
  if (master) out.push(new TextEncoder().encode(master));
  if (jwt && jwt !== master) out.push(new TextEncoder().encode(jwt));
  else if (jwt && !master) out.push(new TextEncoder().encode(jwt));
  return out;
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

async function verificarPayloadMaster(token: string): Promise<PayloadSessao | null> {
  for (const secret of secretsMasterJwt()) {
    try {
      const { payload } = await jwtVerify(token, secret);
      return payload as PayloadSessao;
    } catch {
      /* próximo segredo */
    }
  }
  return null;
}

async function sessionTokenAceito(token: string): Promise<boolean> {
  const payload = await verificarPayloadSessao(token);
  if (!payload) return false;
  return typeof payload.id === "string" && payload.id.length > 0;
}

async function masterTokenAceito(token: string): Promise<boolean> {
  const payload = await verificarPayloadMaster(token);
  if (!payload) return false;
  return (
    payload.master === true &&
    payload.role === "MASTER_ADMIN" &&
    typeof payload.id === "string" &&
    payload.id.length > 0
  );
}

function apiMutavel(method: string) {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

function hostnameDeUrl(valor: string | null): string | null {
  if (!valor?.trim()) return null;
  try {
    return new URL(valor).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** CSRF defense-in-depth para APIs mutáveis (exceto webhooks e rotas sem cookie). */
function origemApiPermitida(request: NextRequest): boolean {
  if (!apiMutavel(request.method)) return true;
  const { pathname } = request.nextUrl;
  if (
    pathname === "/api/mercadopago/webhook" ||
    pathname === "/api/asaas/webhook" ||
    pathname === "/api/whatsapp/webhook" ||
    pathname === "/api/asaas/autorizacao-saque"
  ) {
    return true;
  }

  const origin = hostnameDeUrl(request.headers.get("origin"));
  const referer = hostnameDeUrl(request.headers.get("referer"));
  const hostHeader = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!origin && !referer) return true;

  const candidato = origin || referer!;
  if (hostHeader && candidato === hostHeader) return true;
  if (candidato === "localhost" || candidato === "127.0.0.1") return true;
  if (
    candidato === "denteartlab.com.br" ||
    candidato === "www.denteartlab.com.br" ||
    candidato.endsWith(".denteartlab.com.br")
  ) {
    return true;
  }
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.URL_PUBLICA_DO_APP?.trim(),
  ]) {
    if (!raw) continue;
    try {
      if (new URL(raw).hostname.toLowerCase() === candidato) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
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

function aplicarCsp(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", montarContentSecurityPolicy(nonce));
  return response;
}

function headersRequestComNonce(request: NextRequest, nonce: string) {
  const csp = montarContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return { requestHeaders, csp };
}

/** Passa nonce/CSP ao RSC (Next lê CSP na request) e na resposta HTTP. */
function nextComCsp(request: NextRequest, nonce: string) {
  const { requestHeaders, csp } = headersRequestComNonce(request, nonce);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function rewriteComCsp(request: NextRequest, url: URL, nonce: string) {
  const { requestHeaders, csp } = headersRequestComNonce(request, nonce);
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * Origem pública sem :3000. Mantém o MESMO host da requisição (apex ou www) —
 * forçar www causava loop com o proxy que redireciona www → apex.
 */
function origemPublica(request: NextRequest): string {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() || "";
  if (host === "denteartlab.com.br" || host === "www.denteartlab.com.br") {
    return `https://${host}`;
  }
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    "";
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      /* ignora */
    }
  }
  const u = request.nextUrl.clone();
  if (u.port === "3000") {
    u.port = "";
    if (u.protocol === "http:") u.protocol = "https:";
  }
  return u.origin;
}

function urlNoSite(request: NextRequest, caminho: string): URL {
  return new URL(caminho, origemPublica(request));
}

function processarRotaApp(
  request: NextRequest,
  pathname: string,
  slugSessao: string | null,
  nonce: string
): NextResponse | null {
  if (!pathname.startsWith("/app")) return null;

  if (!slugSessao) {
    const login = urlNoSite(request, "/login");
    login.searchParams.set("redirect", pathname);
    return aplicarCsp(limparCookieSessao(NextResponse.redirect(login)), nonce);
  }

  const { slug, restante, legado } = analisarCaminhoApp(pathname);
  const search = request.nextUrl.search;

  if (legado) {
    const destino = montarCaminhoAppComSlug(slugSessao, restante) + search;
    if (destino !== pathname + search) {
      return aplicarCsp(NextResponse.redirect(urlNoSite(request, destino)), nonce);
    }
    return null;
  }

  if (slug !== slugSessao) {
    const destino = montarCaminhoAppComSlug(slugSessao, restante) + search;
    return aplicarCsp(NextResponse.redirect(urlNoSite(request, destino)), nonce);
  }

  const interno = caminhoInternoApp(restante);
  if (interno === pathname) return null;

  const url = request.nextUrl.clone();
  url.pathname = interno;
  return rewriteComCsp(request, url, nonce);
}

export async function middleware(request: NextRequest) {
  // Sem redirect apex↔www aqui: o proxy já decide o host canônico.
  // O cookie usa Domain=.denteartlab.com.br e vale nos dois.
  const nonce = gerarNonceCsp();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && !origemApiPermitida(request)) {
    return aplicarCsp(
      NextResponse.json(
        { error: "Origem da requisição não permitida." },
        { status: 403 }
      ),
      nonce
    );
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/empresas/cadastro") ||
    pathname === "/api/admin-master/auth/login" ||
    pathname.startsWith("/api/admin-master/auth/mfa") ||
    pathname === "/api/admin-master/auth/logout" ||
    pathname === "/api/version" ||
    pathname === "/api/health"
  ) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/api/orcamentos/public")) {
    return nextComCsp(request, nonce);
  }

  // Legado: /uploads/... → rota autenticada (arquivos saíram de public/)
  if (pathname.startsWith("/uploads/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/uploads/disco/${pathname.slice("/uploads/".length)}`;
    return rewriteComCsp(request, url, nonce);
  }

  if (
    process.env.NODE_ENV !== "production" &&
    pathname.startsWith("/api/dev/")
  ) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/api/clientes/public")) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/api/public/")) {
    return nextComCsp(request, nonce);
  }

  if (pathname === "/api/lab/branding") {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/api/financeiro/fatura-publica/")) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/api/financeiro/extrato-publica/")) {
    return nextComCsp(request, nonce);
  }

  if (
    pathname === "/api/mercadopago/webhook" ||
    pathname === "/api/asaas/webhook" ||
    pathname === "/api/asaas/autorizacao-saque" ||
    pathname === "/api/whatsapp/webhook"
  ) {
    return nextComCsp(request, nonce);
  }

  if (requisicaoTvSocket(pathname) || pathname === "/api/tv/socket-health") {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/fatura/")) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/extrato/")) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/orcamento/")) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/acompanhamento/")) {
    return nextComCsp(request, nonce);
  }

  if (pathname.startsWith("/admin-master") || pathname.startsWith("/api/admin-master")) {
    const masterPublico =
      pathname === "/admin-master/login" ||
      pathname === "/api/admin-master/auth/login" ||
      pathname.startsWith("/api/admin-master/auth/mfa") ||
      pathname === "/api/admin-master/auth/logout";
    if (masterPublico) {
      const masterToken = request.cookies.get(MASTER_COOKIE_NAME)?.value;
      if (masterToken && (await masterTokenAceito(masterToken))) {
        return aplicarCsp(
          NextResponse.redirect(urlNoSite(request, "/admin-master")),
          nonce
        );
      }
      return nextComCsp(request, nonce);
    }

    const masterToken = request.cookies.get(MASTER_COOKIE_NAME)?.value;
    if (!masterToken || !(await masterTokenAceito(masterToken))) {
      if (pathname.startsWith("/api/admin-master")) {
        return aplicarCsp(
          NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 403 }),
          nonce
        );
      }
      const login = urlNoSite(request, "/admin-master/login");
      login.searchParams.set("redirect", pathname);
      return aplicarCsp(NextResponse.redirect(login), nonce);
    }

    return nextComCsp(request, nonce);
  }

  if (PUBLIC.includes(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const res =
      token && !(await sessionTokenAceito(token))
        ? limparCookieSessao(nextComCsp(request, nonce))
        : nextComCsp(request, nonce);

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
      return aplicarCsp(limparCookieSessao(NextResponse.redirect(login)), nonce);
    }
    return nextComCsp(request, nonce);
  }

  const needsAuthLegacy = pathname.startsWith("/app") || pathname.startsWith("/api");

  if (!needsAuthLegacy) {
    const res = nextComCsp(request, nonce);
    if (pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i)) {
      res.headers.set("Cache-Control", "public, max-age=86400, must-revalidate");
    }
    return res;
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payloadSessao = token ? await verificarPayloadSessao(token) : null;
  if (!token || !payloadSessao?.id) {
    if (pathname.startsWith("/api")) {
      return aplicarCsp(
        NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
        nonce
      );
    }
    const login = urlNoSite(request, "/login");
    login.searchParams.set("redirect", pathname);
    return aplicarCsp(limparCookieSessao(NextResponse.redirect(login)), nonce);
  }

  if (payloadSessao.assinaturaVencida === true) {
    if (pathname.startsWith("/app")) {
      return aplicarCsp(
        NextResponse.redirect(urlNoSite(request, "/assinatura-vencida")),
        nonce
      );
    }
    if (pathname.startsWith("/api") && !apiLiberadaAssinaturaVencida(pathname)) {
      return aplicarCsp(
        NextResponse.json(
          { error: "Assinatura vencida. Regularize em /assinatura-vencida." },
          { status: 403 }
        ),
        nonce
      );
    }
  }

  if (pathname.startsWith("/app")) {
    const rotaApp = processarRotaApp(
      request,
      pathname,
      payloadSessao.empresaSlug?.trim() || null,
      nonce
    );
    if (rotaApp) return rotaApp;
  }

  const res = nextComCsp(request, nonce);
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
