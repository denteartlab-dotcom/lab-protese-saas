import { createHash, randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { enviarEmailResend } from "@/lib/email-resend";
import { prisma } from "@/lib/db";
import { urlPublicaApp } from "@/lib/url-publica-app";

const VALIDADE_HORAS = 1;

export function hashTokenRecuperacao(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function gerarTokenRecuperacao(): string {
  return randomBytes(32).toString("hex");
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function solicitarRecuperacaoSenha(emailBruto: string): Promise<{
  enviado: boolean;
  erroInterno?: string;
}> {
  const email = emailBruto.trim().toLowerCase();
  if (!email) return { enviado: true };

  const usuarios = await prisma.user.findMany({
    where: { email, excluidoEm: null },
    select: {
      id: true,
      name: true,
      empresa: { select: { nome: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (usuarios.length === 0) {
    return { enviado: true };
  }

  const baseUrl = urlPublicaApp();
  const expiraEm = new Date(Date.now() + VALIDADE_HORAS * 60 * 60 * 1000);
  const links: { rotulo: string; url: string }[] = [];

  for (const usuario of usuarios) {
    const token = gerarTokenRecuperacao();
    const tokenHash = hashTokenRecuperacao(token);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: usuario.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: usuario.id,
        tokenHash,
        expiresAt: expiraEm,
      },
    });

    const lab = usuario.empresa?.nome?.trim() || "Laboratório";
    links.push({
      rotulo: lab,
      url: `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`,
    });
  }

  const listaLinks =
    links.length === 1
      ? `<p style="margin:24px 0"><a href="${links[0].url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Redefinir minha senha</a></p>`
      : `<ul style="padding-left:20px">${links
          .map(
            (item) =>
              `<li style="margin:8px 0"><strong>${escapeHtml(item.rotulo)}</strong><br/><a href="${item.url}">${item.url}</a></li>`
          )
          .join("")}</ul>`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px;color:#1e3a8a">Recuperação de senha</h1>
      <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Lab Prótese</strong>.</p>
      ${listaLinks}
      <p style="font-size:13px;color:#64748b">O link expira em ${VALIDADE_HORAS} hora(s). Se você não solicitou, ignore este e-mail.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:32px">Lab Prótese — denteartlab.com.br</p>
    </div>
  `;

  const resultado = await enviarEmailResend({
    to: email,
    subject: "Recuperação de senha — Lab Prótese",
    html,
    text: `Redefina sua senha: ${links.map((l) => `${l.rotulo}: ${l.url}`).join("\n")}`,
  });

  if (!resultado.ok) {
    return { enviado: false, erroInterno: resultado.erro };
  }

  return { enviado: true };
}

export async function redefinirSenhaComToken(
  tokenBruto: string,
  novaSenha: string
): Promise<{ ok: boolean; erro?: string }> {
  const token = tokenBruto.trim();
  if (!token) {
    return { ok: false, erro: "Link inválido ou expirado." };
  }

  const tokenHash = hashTokenRecuperacao(token);
  const registro = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, excluidoEm: true },
      },
    },
  });

  if (!registro || registro.usedAt || registro.user.excluidoEm) {
    return { ok: false, erro: "Link inválido ou expirado." };
  }

  if (registro.expiresAt.getTime() < Date.now()) {
    return { ok: false, erro: "Link expirado. Solicite um novo e-mail." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: registro.userId },
      data: { password: await hashPassword(novaSenha) },
    }),
    prisma.passwordResetToken.update({
      where: { id: registro.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: registro.userId, usedAt: null },
    }),
  ]);

  return { ok: true };
}
