import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual."),
  novaSenha: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres."),
  confirmarSenha: z.string().min(1, "Confirme a nova senha."),
});

export async function POST(request: Request) {
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

    const usuario = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, password: true },
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const senhaOk = await verifyPassword(data.senhaAtual, usuario.password);
    if (!senhaOk) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: usuario.id },
      data: { password: await hashPassword(data.novaSenha) },
    });

    return NextResponse.json({ ok: true, message: "Senha alterada com sucesso." });
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
