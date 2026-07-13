import { NextResponse } from "next/server";

/**
 * Em produção, `/api/setup/*` só roda com ALLOW_SETUP=true e header x-setup-secret.
 * Em desenvolvimento fica aberto para bootstrap local.
 */
export function setupBloqueado(request: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;

  if (process.env.ALLOW_SETUP !== "true") {
    return NextResponse.json({ ok: false, erro: "Não encontrado." }, { status: 404 });
  }

  const secret = process.env.SETUP_SECRET?.trim();
  const enviado = request.headers.get("x-setup-secret")?.trim();
  if (!secret || enviado !== secret) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  return null;
}

/** Em produção não devolvemos senha em plaintext na resposta do setup. */
export function podeExporSenhaSetup(): boolean {
  return process.env.NODE_ENV !== "production";
}
