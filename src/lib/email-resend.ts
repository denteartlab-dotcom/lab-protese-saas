import { Resend } from "resend";
import { promessaComTimeout } from "@/lib/http-integracao";

export type EnviarEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

function remetentePadrao() {
  return (
    process.env.EMAIL_FROM?.trim() || "Lab Prótese <noreply@denteartlab.com.br>"
  );
}

function replyToPadrao() {
  return process.env.EMAIL_REPLY_TO?.trim() || undefined;
}

export function emailResendConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Envia e-mail transacional via Resend. */
export async function enviarEmailResend(params: EnviarEmailParams): Promise<{
  ok: boolean;
  id?: string;
  erro?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, erro: "RESEND_API_KEY não configurada no servidor." };
  }

  const resend = new Resend(apiKey);
  const destinatarios = Array.isArray(params.to) ? params.to : [params.to];

  try {
    const { data, error } = await promessaComTimeout(
      resend.emails.send({
        from: remetentePadrao(),
        to: destinatarios,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo || replyToPadrao(),
      }),
      { integracao: "resend", rotulo: "resend.emails.send" }
    );

    if (error) {
      console.error("[email-resend]", error);
      return { ok: false, erro: error.message || "Falha ao enviar e-mail." };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email-resend]", err);
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha ao enviar e-mail.",
    };
  }
}
