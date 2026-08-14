import { NextResponse } from "next/server";
import { z } from "zod";
import {
  anexarCookieSessao,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { executarSemRls } from "@/lib/prisma-tenant";
import { montarSessionUserComAssinatura } from "@/lib/sessao-assinatura";
import {
  bumpSessionVersionUsuario,
  invalidarCacheSessionVersion,
} from "@/lib/session-version";
import { validarForcaSenha } from "@/lib/validar-senha";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";

const schema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual."),
  novaSenha: z.string().min(1, "Informe a nova senha."),
  confirmarSenha: z.string().min(1, "Confirme a nova senha."),
});

export async function POST(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    if (data.novaSenha !== data.confirmarSenha) {
      return NextResponse.json(
        { error: "A confirmação não coincide com a nova senha." },
        { status: 400 }
      );
    }

    if (data.senhaAtual === data.novaSenha) {
      return NextResponse.json(
        { error: "A nova senha deve ser diferente da senha atual." },
        { status: 400 }
      );
    }

    const forca = validarForcaSenha(data.novaSenha);
    if (!forca.valida) {
      return NextResponse.json(
        { error: forca.erros[0] || "Senha fraca.", erros: forca.erros },
        { status: 400 }
      );
    }

    const usuario = await executarSemRls((tx) =>
      tx.user.findUnique({
        where: { id: session.id },
        select: { id: true, password: true },
      })
    );

    if (!usuario) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const senhaOk = await verifyPassword(data.senhaAtual, usuario.password);
    if (!senhaOk) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
    }

    const novaVersao = await bumpSessionVersionUsuario(usuario.id);
    const senhaHash = await hashPassword(data.novaSenha);
    await executarSemRls((tx) =>
      tx.user.update({
        where: { id: usuario.id },
        data: { password: senhaHash },
      })
    );
    invalidarCacheSessionVersion(usuario.id);

    const sessionUser = await montarSessionUserComAssinatura(usuario.id);
    const resposta = NextResponse.json({
      ok: true,
      message: "Senha alterada com sucesso.",
    });
    if (sessionUser) {
      return anexarCookieSessao(
        resposta,
        { ...sessionUser, sessionVersion: novaVersao },
        { request }
      );
    }
    return resposta;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    console.error("[alterar-senha]", err);
    return NextResponse.json({ error: "Erro ao alterar senha." }, { status: 500 });
  }
}
