import { NextResponse } from "next/server";
import { z } from "zod";
import { emailResendConfigurado } from "@/lib/email-resend";
import { solicitarRecuperacaoSenha } from "@/lib/recuperacao-senha";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const RESPOSTA_OK = {
  ok: true,
  message:
    "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos.",
};

export async function POST(request: Request) {
  if (!emailResendConfigurado()) {
    return NextResponse.json(
      {
        error:
          "Envio de e-mail não configurado no servidor. Contate o suporte.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { email } = schema.parse(body);
    const resultado = await solicitarRecuperacaoSenha(email);

    if (!resultado.enviado) {
      console.error("[recuperar-senha]", resultado.erroInterno);
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail. Tente novamente mais tarde." },
        { status: 500 }
      );
    }

    return NextResponse.json(RESPOSTA_OK);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "E-mail inválido." },
        { status: 400 }
      );
    }
    console.error("[recuperar-senha]", err);
    return NextResponse.json({ error: "Erro ao processar solicitação." }, { status: 500 });
  }
}
