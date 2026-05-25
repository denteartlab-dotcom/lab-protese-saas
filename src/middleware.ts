import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "lab-protese-session";
const PUBLIC = ["/login"];

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "lab-protese-dev-secret-change-in-production"
  );
}

async function validToken(token: string) {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/orcamentos/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/clientes/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/asaas/webhook")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/orcamento/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/acompanhamento/")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token && (await validToken(token))) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (PUBLIC.includes(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token && (await validToken(token))) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return NextResponse.next();
  }

  const needsAuth =
    pathname.startsWith("/app") || pathname.startsWith("/api");

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await validToken(token))) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
