import { NextResponse } from "next/server";
import { z } from "zod";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import {
  aplicarCookieSessaoPortal,
  buscarMetaClientePortalPorToken,
  clientePortalAcessoDisponivel,
  CODIGO_SENHA_PORTAL_INVALIDA,
  CODIGO_SENHA_PORTAL_NAO_CONFIGURADA,
  criarTokenSessaoPortalAcompanhamento,
  limparCookieSessaoPortal,
  sessaoPortalValidaParaToken,
  verificarSenhaPortalCliente,
} from "@/lib/cliente-portal-auth";

type Params = { params: Promise<{ token: string }> };

const schemaLogin = z.object({
  senha: z.string().min(1, "Informe a senha."),
});

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const meta = await buscarMetaClientePortalPorToken(token);
  if (!meta || !clientePortalAcessoDisponivel(meta)) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  const autenticado = Boolean(
    meta.senhaPortalHash &&
      (await sessaoPortalValidaParaToken(request, token, meta.id))
  );

  return NextResponse.json({
    ok: true,
    clienteNome: meta.nome,
    requerLogin: true,
    senhaConfigurada: Boolean(meta.senhaPortalHash),
    autenticado,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const meta = await buscarMetaClientePortalPorToken(token);
  if (!meta || !clientePortalAcessoDisponivel(meta)) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  if (!meta.senhaPortalHash) {
    return NextResponse.json(
      {
        error: CODIGO_SENHA_PORTAL_NAO_CONFIGURADA,
        message:
          "Acesso ainda não configurado. Solicite a senha de acesso ao laboratório.",
        clienteNome: meta.nome,
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Dados inválidos." },
      { status: 400 }
    );
  }

  const parsed = schemaLogin.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "senha_obrigatoria", message: "Informe a senha." },
      { status: 400 }
    );
  }

  const ok = await verificarSenhaPortalCliente(
    parsed.data.senha,
    meta.senhaPortalHash
  );
  if (!ok) {
    return NextResponse.json(
      {
        error: CODIGO_SENHA_PORTAL_INVALIDA,
        message: "Senha incorreta.",
        clienteNome: meta.nome,
      },
      { status: 401 }
    );
  }

  const jwt = await criarTokenSessaoPortalAcompanhamento({
    clienteId: meta.id,
    token: token.trim(),
    empresaId: meta.empresaId,
  });

  const response = NextResponse.json({
    ok: true,
    autenticado: true,
    clienteNome: meta.nome,
  });
  return aplicarCookieSessaoPortal(response, jwt, request);
}

export async function DELETE(request: Request, { params }: Params) {
  const { token } = await params;
  const response = NextResponse.json({ ok: true });
  return limparCookieSessaoPortal(response, request);
}
