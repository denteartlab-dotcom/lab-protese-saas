import { NextResponse } from "next/server";

/**
 * Setup (bootstrap) só sobe com segredo one-time.
 * - Produção: sempre exige ALLOW_SETUP=true + SETUP_SECRET no header x-setup-secret.
 * - Desenvolvimento: mesma regra se SETUP_SECRET estiver definido; caso contrário
 *   fica aberto só com NODE_ENV !== production (bootstrap local).
 */
export function setupBloqueado(request: Request): NextResponse | null {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.SETUP_SECRET?.trim();
  const enviado = request.headers.get("x-setup-secret")?.trim();
  const allowFlag = process.env.ALLOW_SETUP === "true";

  if (isProd) {
    if (!allowFlag) {
      return NextResponse.json({ ok: false, erro: "Não encontrado." }, { status: 404 });
    }
    if (!secret || enviado !== secret) {
      return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
    }
    return null;
  }

  // Dev: se SETUP_SECRET existir, exige o mesmo header (treino de prod).
  if (secret && enviado !== secret) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  return null;
}

/** Em produção não devolvemos senha em plaintext na resposta do setup. */
export function podeExporSenhaSetup(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Senha de bootstrap — nunca usa default fraco em produção.
 * Em prod: SETUP_ADMIN_PASSWORD / MASTER_ADMIN_PASSWORD obrigatórios.
 */
export function senhaBootstrapObrigatoria(
  envName: "SETUP_ADMIN_PASSWORD" | "MASTER_ADMIN_PASSWORD"
): { ok: true; senha: string } | { ok: false; erro: string } {
  const senha = process.env[envName]?.trim();
  if (senha && senha.length >= 8) {
    return { ok: true, senha };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      erro: `${envName} obrigatória em produção (mín. 8 caracteres). Não use senhas padrão.`,
    };
  }
  // Dev apenas — valor local óbvio; nunca em produção.
  return { ok: true, senha: "dev-only-change-me" };
}
