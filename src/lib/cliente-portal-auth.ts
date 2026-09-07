import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { hashPassword, verifyPassword, opcoesCookieSessao } from "@/lib/auth";
import { executarSemRls } from "@/lib/db";

export const COOKIE_PORTAL_ACOMPANHAMENTO = "lab-acompanhamento-portal";
export const PORTAL_ACOMPANHAMENTO_TTL_S = 7 * 24 * 60 * 60;

export const CODIGO_LOGIN_PORTAL_NECESSARIO = "login_necessario";
export const CODIGO_SENHA_PORTAL_NAO_CONFIGURADA = "senha_nao_configurada";
export const CODIGO_SENHA_PORTAL_INVALIDA = "senha_invalida";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

function getSecretOrNull() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export type SessaoPortalAcompanhamento = {
  clienteId: string;
  token: string;
  empresaId: string;
};

export type MetaClientePortal = {
  id: string;
  empresaId: string;
  nome: string;
  senhaPortalHash: string | null;
  ativo: boolean;
  removidoEm: Date | null;
};

export async function buscarMetaClientePortalPorToken(
  token: string
): Promise<MetaClientePortal | null> {
  const limpo = token.trim();
  if (!limpo) return null;
  return executarSemRls((tx) =>
    tx.cliente.findFirst({
      where: { tokenAcompanhamento: limpo },
      select: {
        id: true,
        empresaId: true,
        nome: true,
        senhaPortalHash: true,
        ativo: true,
        removidoEm: true,
      },
    })
  );
}

export function clientePortalAcessoDisponivel(meta: MetaClientePortal) {
  return meta.ativo && !meta.removidoEm;
}

export async function hashSenhaPortalCliente(senha: string) {
  return hashPassword(senha);
}

export async function verificarSenhaPortalCliente(
  senha: string,
  hash: string
) {
  return verifyPassword(senha, hash);
}

export async function criarTokenSessaoPortalAcompanhamento(
  sessao: SessaoPortalAcompanhamento
) {
  return new SignJWT({
    typ: "acompanhamento",
    cid: sessao.clienteId,
    tok: sessao.token,
    eid: sessao.empresaId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_ACOMPANHAMENTO_TTL_S}s`)
    .sign(getSecret());
}

export async function verificarTokenSessaoPortalAcompanhamento(
  jwt: string
): Promise<SessaoPortalAcompanhamento | null> {
  const secret = getSecretOrNull();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret);
    if (payload.typ !== "acompanhamento") return null;
    const clienteId = typeof payload.cid === "string" ? payload.cid : "";
    const token = typeof payload.tok === "string" ? payload.tok : "";
    const empresaId = typeof payload.eid === "string" ? payload.eid : "";
    if (!clienteId || !token || !empresaId) return null;
    return { clienteId, token, empresaId };
  } catch {
    return null;
  }
}

function cookiePortalDoRequest(request?: Request): string | null {
  if (request) {
    const raw = request.headers.get("cookie") || "";
    const partes = raw.split(";");
    for (const parte of partes) {
      const [k, ...rest] = parte.trim().split("=");
      if (k === COOKIE_PORTAL_ACOMPANHAMENTO) {
        return decodeURIComponent(rest.join("=") || "");
      }
    }
    return null;
  }
  return null;
}

export async function lerSessaoPortalAcompanhamento(
  request?: Request
): Promise<SessaoPortalAcompanhamento | null> {
  const doHeader = cookiePortalDoRequest(request);
  if (doHeader) {
    return verificarTokenSessaoPortalAcompanhamento(doHeader);
  }
  try {
    const jar = await cookies();
    const valor = jar.get(COOKIE_PORTAL_ACOMPANHAMENTO)?.value;
    if (!valor) return null;
    return verificarTokenSessaoPortalAcompanhamento(valor);
  } catch {
    return null;
  }
}

export async function sessaoPortalValidaParaToken(
  request: Request | undefined,
  token: string,
  clienteId?: string
): Promise<SessaoPortalAcompanhamento | null> {
  const sessao = await lerSessaoPortalAcompanhamento(request);
  if (!sessao) return null;
  if (sessao.token !== token.trim()) return null;
  if (clienteId && sessao.clienteId !== clienteId) return null;
  return sessao;
}

export function opcoesCookiePortalAcompanhamento(request?: Request) {
  return opcoesCookieSessao(PORTAL_ACOMPANHAMENTO_TTL_S, request);
}

export function aplicarCookieSessaoPortal(
  response: NextResponse,
  jwt: string,
  request?: Request
) {
  response.cookies.set(
    COOKIE_PORTAL_ACOMPANHAMENTO,
    jwt,
    opcoesCookiePortalAcompanhamento(request)
  );
  return response;
}

export function limparCookieSessaoPortal(
  response: NextResponse,
  request?: Request
) {
  response.cookies.set(COOKIE_PORTAL_ACOMPANHAMENTO, "", {
    ...opcoesCookiePortalAcompanhamento(request),
    maxAge: 0,
  });
  return response;
}

/**
 * Garante senha configurada + sessão válida para o token do link.
 * Retorna NextResponse de erro ou a meta autenticada.
 */
export async function exigirSessaoPortalAcompanhamento(
  request: Request,
  token: string
): Promise<
  | { ok: true; meta: MetaClientePortal; sessao: SessaoPortalAcompanhamento }
  | { ok: false; response: NextResponse }
> {
  const meta = await buscarMetaClientePortalPorToken(token);
  if (!meta || !clientePortalAcessoDisponivel(meta)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "link_invalido",
          message: "Link inválido ou indisponível.",
        },
        { status: 404 }
      ),
    };
  }

  if (!meta.senhaPortalHash) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: CODIGO_SENHA_PORTAL_NAO_CONFIGURADA,
          message:
            "Acesso ainda não configurado. Solicite a senha de acesso ao laboratório.",
          clienteNome: meta.nome,
        },
        { status: 403 }
      ),
    };
  }

  const sessao = await sessaoPortalValidaParaToken(request, token, meta.id);
  if (!sessao) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: CODIGO_LOGIN_PORTAL_NECESSARIO,
          message: "Informe a senha para acessar o acompanhamento.",
          clienteNome: meta.nome,
        },
        { status: 401 }
      ),
    };
  }

  return { ok: true, meta, sessao };
}

export function sanitizarClienteSemSenhaPortal<T extends Record<string, unknown>>(
  cliente: T
): T & { temSenhaPortal: boolean } {
  const { senhaPortalHash, ...rest } = cliente as T & {
    senhaPortalHash?: string | null;
  };
  return {
    ...(rest as T),
    temSenhaPortal: Boolean(senhaPortalHash),
  };
}
