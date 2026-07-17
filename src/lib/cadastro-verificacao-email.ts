import { createHash, randomInt } from "crypto";
import { enviarEmailResend } from "@/lib/email-resend";
import { executarSemRls } from "@/lib/db";

const VALIDADE_MINUTOS = 10;
const INTERVALO_REENVIO_MS = 60_000;

export function hashCodigoVerificacao(email: string, codigo: string): string {
  return createHash("sha256").update(`${email.trim().toLowerCase()}:${codigo}`).digest("hex");
}

export function gerarCodigoVerificacao(): string {
  return String(randomInt(100000, 1000000));
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Cadastro público: User/Master/CadastroVerificacaoEmail exigem bypass RLS. */
async function emailJaCadastrado(email: string): Promise<boolean> {
  return executarSemRls(async (tx) => {
    const usuario = await tx.user.findFirst({
      where: { email, excluidoEm: null },
      select: { id: true },
    });
    if (usuario) return true;

    const master = await tx.masterUser.findUnique({ where: { email } });
    return Boolean(master);
  });
}

export async function enviarCodigoVerificacaoCadastro(emailBruto: string): Promise<{
  enviado: boolean;
  erro?: string;
  aguardarSegundos?: number;
}> {
  const email = emailBruto.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { enviado: false, erro: "Informe um e-mail válido." };
  }

  if (await emailJaCadastrado(email)) {
    return {
      enviado: false,
      erro: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
    };
  }

  const ultimo = await executarSemRls((tx) =>
    tx.cadastroVerificacaoEmail.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: "desc" },
    })
  );

  if (ultimo) {
    const decorrido = Date.now() - ultimo.createdAt.getTime();
    if (decorrido < INTERVALO_REENVIO_MS) {
      const aguardarSegundos = Math.ceil((INTERVALO_REENVIO_MS - decorrido) / 1000);
      return {
        enviado: false,
        erro: `Aguarde ${aguardarSegundos}s para reenviar o código.`,
        aguardarSegundos,
      };
    }
  }

  const codigo = gerarCodigoVerificacao();
  const codigoHash = hashCodigoVerificacao(email, codigo);
  const expiraEm = new Date(Date.now() + VALIDADE_MINUTOS * 60 * 1000);

  await executarSemRls(async (tx) => {
    await tx.cadastroVerificacaoEmail.deleteMany({
      where: { email, usedAt: null },
    });
    await tx.cadastroVerificacaoEmail.create({
      data: {
        email,
        codigoHash,
        expiresAt: expiraEm,
      },
    });
  });

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px;color:#1e3a8a">Confirme seu e-mail</h1>
      <p>Use o código abaixo para concluir o cadastro no <strong>Lab Prótese</strong>:</p>
      <p style="margin:28px 0;font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb;text-align:center">${escapeHtml(codigo)}</p>
      <p style="font-size:13px;color:#64748b">O código expira em ${VALIDADE_MINUTOS} minutos. Se você não solicitou, ignore este e-mail.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:32px">Lab Prótese — denteartlab.com.br</p>
    </div>
  `;

  const resultado = await enviarEmailResend({
    to: email,
    subject: `${codigo} — Código de verificação Lab Prótese`,
    html,
    text: `Seu código de verificação Lab Prótese: ${codigo}. Expira em ${VALIDADE_MINUTOS} minutos.`,
  });

  if (!resultado.ok) {
    await executarSemRls((tx) =>
      tx.cadastroVerificacaoEmail.deleteMany({
        where: { email, codigoHash },
      })
    );
    return { enviado: false, erro: resultado.erro || "Não foi possível enviar o e-mail." };
  }

  return { enviado: true };
}

export async function validarCodigoVerificacaoCadastro(
  emailBruto: string,
  codigoBruto: string
): Promise<{ ok: boolean; erro?: string; registroId?: string }> {
  const email = emailBruto.trim().toLowerCase();
  const codigo = codigoBruto.replace(/\D/g, "");

  if (!email || codigo.length !== 6) {
    return { ok: false, erro: "Informe o código de 6 dígitos enviado por e-mail." };
  }

  const registro = await executarSemRls((tx) =>
    tx.cadastroVerificacaoEmail.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: "desc" },
    })
  );

  if (!registro) {
    return { ok: false, erro: "Código não encontrado. Solicite um novo código." };
  }

  if (registro.expiresAt.getTime() < Date.now()) {
    return { ok: false, erro: "Código expirado. Solicite um novo código." };
  }

  const codigoHash = hashCodigoVerificacao(email, codigo);
  if (registro.codigoHash !== codigoHash) {
    return { ok: false, erro: "Código incorreto. Verifique e tente novamente." };
  }

  return { ok: true, registroId: registro.id };
}

export async function marcarCodigoVerificacaoUsado(registroId: string): Promise<void> {
  await executarSemRls((tx) =>
    tx.cadastroVerificacaoEmail.update({
      where: { id: registroId },
      data: { usedAt: new Date() },
    })
  );
}
