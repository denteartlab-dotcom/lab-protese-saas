import { NextResponse } from "next/server";
import { z } from "zod";
import { enviarCodigoVerificacaoCadastro } from "@/lib/cadastro-verificacao-email";
import { emailResendConfigurado } from "@/lib/email-resend";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

export async function POST(request: Request) {
  if (!emailResendConfigurado()) {
    return NextResponse.json(
      {
        error: "Envio de e-mail não configurado no servidor. Contate o suporte.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { email } = schema.parse(body);
    const resultado = await enviarCodigoVerificacaoCadastro(email);

    if (!resultado.enviado) {
      return NextResponse.json(
        {
          error: resultado.erro || "Não foi possível enviar o código.",
          aguardarSegundos: resultado.aguardarSegundos,
        },
        { status: resultado.aguardarSegundos ? 429 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Código enviado! Verifique sua caixa de entrada e o spam.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "E-mail inválido." },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cadastro/enviar-codigo]", err);
    if (/CadastroVerificacaoEmail|does not exist|P2021/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Sistema desatualizado. Execute npx prisma db push no servidor e reinicie o PM2.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Erro ao enviar código." }, { status: 500 });
  }
}
