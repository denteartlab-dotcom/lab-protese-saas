import { NextResponse } from "next/server";
import { z } from "zod";
import { redefinirSenhaComToken } from "@/lib/recuperacao-senha";
import { validarForcaSenha } from "@/lib/validar-senha";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";

const schema = z.object({
  token: z.string().min(16, "Link inválido."),
  novaSenha: z.string().min(1, "Informe a nova senha."),
  confirmarSenha: z.string().min(1, "Confirme a nova senha."),
});

export async function POST(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    if (data.novaSenha !== data.confirmarSenha) {
      return NextResponse.json(
        { error: "A confirmação não coincide com a nova senha." },
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

    const resultado = await redefinirSenhaComToken(data.token, data.novaSenha);
    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.erro || "Não foi possível redefinir a senha." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Senha redefinida com sucesso. Faça login com a nova senha.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    console.error("[redefinir-senha]", err);
    return NextResponse.json({ error: "Erro ao redefinir senha." }, { status: 500 });
  }
}
