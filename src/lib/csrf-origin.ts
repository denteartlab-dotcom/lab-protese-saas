/**
 * Allowlist de Origin/Referer para APIs mutáveis (CSRF defense-in-depth).
 * SameSite=Lax já cobre a maior parte; isto bloqueia POSTs cross-site sem Origin válida.
 */
import { NextResponse } from "next/server";

function hostsPermitidos(): Set<string> {
  const hosts = new Set<string>();
  hosts.add("localhost");
  hosts.add("127.0.0.1");

  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.URL_PUBLICA_DO_APP?.trim(),
  ]) {
    if (!raw) continue;
    try {
      const h = new URL(raw).hostname.toLowerCase();
      if (h) hosts.add(h);
    } catch {
      /* ignora */
    }
  }

  hosts.add("denteartlab.com.br");
  hosts.add("www.denteartlab.com.br");
  return hosts;
}

function hostnameDeUrl(valor: string | null): string | null {
  if (!valor?.trim()) return null;
  try {
    return new URL(valor).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function origemRequisicaoPermitida(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin = hostnameDeUrl(request.headers.get("origin"));
  const referer = hostnameDeUrl(request.headers.get("referer"));
  const hostHeader = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  // Sem Origin/Referer (curl, webhooks server-side): libera se Host for nosso
  // ou se não houver Host confiável — webhooks usam rotas públicas sem esta checagem.
  if (!origin && !referer) {
    if (!hostHeader) return true;
    const permitidos = hostsPermitidos();
    return (
      permitidos.has(hostHeader) ||
      hostHeader.endsWith(".denteartlab.com.br") ||
      hostHeader === "localhost" ||
      hostHeader === "127.0.0.1"
    );
  }

  const permitidos = hostsPermitidos();
  const candidato = origin || referer!;
  if (permitidos.has(candidato)) return true;
  if (candidato.endsWith(".denteartlab.com.br")) return true;
  if (hostHeader && candidato === hostHeader) return true;
  return false;
}

export function rejeitarSeOrigemInvalida(request: Request): NextResponse | null {
  if (origemRequisicaoPermitida(request)) return null;
  return NextResponse.json(
    { error: "Origem da requisição não permitida." },
    { status: 403 }
  );
}
