import { NextResponse } from "next/server";
import { z } from "zod";
import { emailResendConfigurado } from "@/lib/email-resend";
import { solicitarRecuperacaoSenha } from "@/lib/recuperacao-senha";
import {
  acaoEmailBloqueada,
  extrairIpLogin,
  registrarAcaoEmail,
} from "@/lib/login-rate-limit";

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
    const ip = extrairIpLogin(request);

    if (await acaoEmailBloqueada("recuperar-senha", ip, email)) {
      return NextResponse.json(
        {
          error:
            "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        },
        { status: 429 }
      );
    }
    await registrarAcaoEmail("recuperar-senha", ip, email);

    const resultado = await solicitarRecuperacaoSenha(email);

    if (!resultado.enviado) {
      console.error("[recuperar-senha]", resultado.erroInterno);
      return NextResponse.json(
        {
          error:
            resultado.erroInterno?.includes("RESEND") ||
            resultado.erroInterno?.includes("API key")
              ? "Serviço de e-mail não configurado. Contate o suporte."
              : "Não foi possível enviar o e-mail. Tente novamente mais tarde.",
        },
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[recuperar-senha]", err);
    if (/PasswordResetToken|does not exist|P2021/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Sistema desatualizado. Execute npx prisma db push no servidor e reinicie o PM2.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Erro ao processar solicitação." }, { status: 500 });
  }
}
